import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { getBuildFormatter } from '../formatters/index.js';
import Fuse from 'fuse.js';
import { Build } from '../types/index.js';
import { logger } from '../services/logger.js';
import { BuildFormatterOptions } from '../formatters/builds/Formatter.js';
import { Reporter } from '../ui/reporter.js';

import { Progress } from '../ui/progress.js';

export interface ViewerBuildsOptions extends BaseCommandOptions {
  count?: string;
  page?: string;
  org?: string;
  pipeline?: string;
  branch?: string;
  state?: string;
  createdFrom?: string;
  createdTo?: string;
  mine?: boolean;
  tips?: boolean;
}

const VALID_STATES = [
  'running', 'scheduled', 'passed', 'failing', 'failed',
  'canceled', 'canceling', 'blocked', 'not_run', 'skipped'
];

export class ListBuilds extends BaseCommand {
  constructor(options?: Partial<ViewerBuildsOptions>) {
    super(options);
  }

  /**
   * Map a GraphQL GetBuilds response (for a single pipeline) into the Build
   * shape the formatters consume. Injects the known pipeline slug because the
   * build node does not carry it. Returns { builds, hasNextPage }.
   */
  private mapPipelineBuilds(
    result: any,
    pipelineSlug: string
  ): { builds: any[]; hasNextPage: boolean } {
    const pipelineNode = result?.pipeline;
    const slug = pipelineNode?.slug || pipelineSlug;
    const edges = pipelineNode?.builds?.edges || [];
    const hasNextPage = !!pipelineNode?.builds?.pageInfo?.hasNextPage;

    const builds = edges
      .map((e: any) => e?.node)
      .filter(Boolean)
      .map((n: any) => ({
        number: n.number,
        state: n.state,
        branch: n.branch,
        message: n.message,
        commit: n.commit,
        url: n.url,
        source: n.source,
        createdAt: n.createdAt,
        startedAt: n.startedAt,
        finishedAt: n.finishedAt,
        createdBy: n.createdBy || null,
        pipeline: { slug, name: pipelineNode?.name || slug },
      }));

    return { builds, hasNextPage };
  }

  /**
   * Normalize a user-supplied date (YYYY-MM-DD or ISO 8601) to an RFC3339
   * timestamp for the GraphQL DateTime scalar. Returns null if unparseable.
   */
  private normalizeDate(input: string): string | null {
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  async execute(options: ViewerBuildsOptions): Promise<number> {
    // Validate state option if provided
    if (options.state && !VALID_STATES.includes(options.state.toLowerCase())) {
      const validList = VALID_STATES.join(', ');
      process.stderr.write(
        `Invalid state '${options.state}'\n` +
        `Valid states: ${validList}\n`
      );
      return 1;
    }

    // A date range only applies to the pipeline-scoped path (not --mine).
    if ((options.createdFrom || options.createdTo) && (!options.pipeline || options.mine)) {
      process.stderr.write(
        'Date filters (--created-from/--created-to) require a pipeline and ' +
        'are not compatible with --mine.\n' +
        'Specify a pipeline with --pipeline <slug> or as org/pipeline, without --mine.\n'
      );
      return 1;
    }

    // Validate and normalize date-range options, storing the result back.
    for (const key of ['createdFrom', 'createdTo'] as const) {
      const raw = options[key];
      if (raw) {
        const normalized = this.normalizeDate(raw);
        if (!normalized) {
          const flag = key === 'createdFrom' ? '--created-from' : '--created-to';
          process.stderr.write(
            `Invalid date '${raw}' for ${flag}\n` +
            `Use YYYY-MM-DD or an ISO 8601 timestamp.\n`
          );
          return 1;
        }
        options[key] = normalized;
      }
    }

    await this.ensureInitialized();
    
    const executeStartTime = process.hrtime.bigint();
    if (options.debug) {
      logger.debug('Starting ViewerBuildsCommandHandler execution');
    }
    
    try {
      const format = options.format || 'plain';
      const reporter = new Reporter(format, options.quiet, options.tips);
      const viewerSpinner = Progress.spinner('Fetching viewer info...', { format });
      // First, get the current user's information using GraphQL
      const viewerData = await this.client.getViewer();
      viewerSpinner.stop();
      
      if (!viewerData?.viewer?.user?.uuid) {
        logger.error('Failed to get current user UUID information');
        return 1;
      }
      
      const userId = viewerData.viewer.user.uuid;
      const userName = viewerData.viewer.user.name || 'Current user';
      const userEmail = viewerData.viewer.user.email;
      
      // Use the REST API to get builds by the current user
      const perPage = options.count || '10';
      const page = options.page || '1';
      
      // If organization is not specified, we need to fetch organizations first
      let orgs: string[] = [];
      if (!options.org) {
        // Try to fetch the user's organizations
        try {
          orgs = await this.client.getViewerOrganizationSlugs();
        } catch (error) {
          logger.error(error as any, 'Failed to determine your organizations');
          return 1;
        }
      } else {
        orgs = [options.org];
      }
      
      // Initialize results array
      let allBuilds: Build[] = [];
      let accessErrors: string[] = [];
      let pipelineHasMore = false;
      
      // Use progress bar for multiple orgs, spinner for single org
      const useProgressBar = orgs.length > 1 && format === 'plain';
      const progress = useProgressBar ? Progress.bar({
        total: orgs.length,
        label: 'Fetching builds from organizations',
        format: format
      }) : null;
      
      // Create a spinner for single-org scenario
      let fetchSpinner = !useProgressBar ? Progress.spinner(undefined, { format }) : null;
      
      for (let i = 0; i < orgs.length; i++) {
        const org = orgs[i];
        
        try {
          if (progress) {
            progress.update(i, `Fetching builds from ${org}`);
          } else if (fetchSpinner) {
            fetchSpinner.update(`Fetching builds from ${org}…`, `Fetching builds from ${org}…`);
          }
          
          // First check if the user has access to this organization
          const hasAccess = await this.restClient.hasOrganizationAccess(org);
          if (!hasAccess) {
            accessErrors.push(`You don't have access to organization ${org}`);
            if (progress) {
              // Continue to next org with progress bar
              progress.update(i + 1, `No access to ${org}`);
            } else if (fetchSpinner) {
              fetchSpinner.fail(`No access to ${org}`);
            }
            continue;
          }
          
          const usePipelineScope = !!options.pipeline && !options.mine;

          let builds: any[];
          if (usePipelineScope) {
            const result = await this.client.getBuilds(options.pipeline!, org, {
              first: parseInt(perPage, 10),
              createdAtFrom: options.createdFrom,
              createdAtTo: options.createdTo,
              state: options.state ? [options.state.toUpperCase()] : undefined,
              branch: options.branch ? [options.branch] : undefined,
            });
            const mapped = this.mapPipelineBuilds(result, options.pipeline!);
            builds = mapped.builds;
            if (mapped.hasNextPage) {
              pipelineHasMore = true;
            }
          } else {
            builds = await this.restClient.getBuilds(org, {
              creator: userId,
              pipeline: options.pipeline,
              branch: options.branch,
              state: options.state,
              per_page: perPage,
              page: page
            });
          }
          
          if (options.debug) {
            logger.debug(`Received ${builds.length} builds from org ${org}`);
          }
          
          allBuilds = allBuilds.concat(builds);
          
          if (!progress && fetchSpinner) {
            fetchSpinner.stop();
          }
        } catch (error) {
          // Log unexpected errors but continue processing other orgs
          logger.error(error, `Error fetching builds for org ${org}`);
          if (!progress && fetchSpinner) {
            fetchSpinner.stop();
          }
        }
      }
      
      // Complete the progress bar
      if (progress) {
        const successOrgs = orgs.length - accessErrors.length;
        progress.complete(`Retrieved ${allBuilds.length} builds from ${successOrgs}/${orgs.length} organizations`);
      }
      
      // Prepare formatter options
      const formatterOptions: BuildFormatterOptions = {
        debug: options.debug,
        tips: options.tips,
        organizationsCount: orgs.length,
        orgSpecified: !!options.org,
        userName,
        userEmail,
        userId,
        pipelineScoped: !!options.pipeline && !options.mine,
        pipelineName: options.pipeline,
      };
      
      // Handle the case where we have no builds due to access issues
      if (allBuilds.length === 0 && accessErrors.length > 0) {
        formatterOptions.hasError = true;
        formatterOptions.errorType = 'access';
        formatterOptions.accessErrors = accessErrors;
        
        if (options.org) {
          formatterOptions.errorMessage = `No builds found for ${userName} (${userEmail}) in organization ${options.org}. ${accessErrors[0]}`;
        } else {
          formatterOptions.errorMessage = `No builds found for ${userName} (${userEmail}). Try specifying an organization with --org to narrow your search.`;
        }
        
        const format = options.format || 'plain';
        const formatter = getBuildFormatter(format);
        const output = formatter.formatBuilds(allBuilds, formatterOptions);
        logger.console(output);
        return 1;
      }
      
      // Limit to the requested number of builds
      allBuilds = allBuilds.slice(0, parseInt(perPage, 10));

      // A pipeline+date-range query returned more than one page. We fetch a
      // single page (consistent with the rest of the CLI); nudge the user.
      const dateRangeActive = !!options.createdFrom || !!options.createdTo;
      if (dateRangeActive && pipelineHasMore && format === 'plain') {
        const perPageNum = parseInt(perPage, 10);
        process.stderr.write(
          `Showing ${perPageNum} builds; more builds exist in this date range. ` +
          `Use --count ${perPageNum * 2} to see more.\n`
        );
      }

      // Apply fuzzy filter if specified
      if (options.filter) {
        if (options.debug) {
          logger.debug(`Applying fuzzy filter '${options.filter}' to ${allBuilds.length} builds`);
        }
        
        // Configure Fuse for fuzzy searching
        const fuse = new Fuse(allBuilds, {
          keys: ['pipeline.name', 'branch', 'message', 'creator.name', 'state'],
          threshold: 0.4,
          includeScore: true,
          shouldSort: true
        });
        
        // Perform the fuzzy search
        const searchResults = fuse.search(options.filter);
        allBuilds = searchResults.map(result => result.item);
        
        if (options.debug) {
          logger.debug(`Filtered to ${allBuilds.length} builds matching '${options.filter}'`);
        }
      }
      
      const formatter = getBuildFormatter(format);
      const output = formatter.formatBuilds(allBuilds, formatterOptions);
      
      // Output data directly to stdout to ensure proper ordering
      if (format === 'plain') {
        process.stdout.write(output + '\n');
      } else {
        logger.console(output);
      }
      
      // Add contextual next-steps hints AFTER showing the data
      if (allBuilds.length > 0) {
        const tips: string[] = [];
        const buildCount = parseInt(perPage, 10);
        
        if (allBuilds.length === buildCount) {
          tips.push(`Use --count ${buildCount * 2} to see more builds`);
        }
        
        // If filtering is not active, suggest filtering options
        if (!options.state && !options.branch && !options.pipeline) {
          tips.push('Filter by state: --state failed');
          tips.push('Filter by branch: --branch main');
          tips.push('Filter by pipeline: --pipeline <name>');
        }
        
        // Display all tips at once
        if (tips.length > 0) {
          // Use individual style for consistency with current output
          tips.forEach(tip => reporter.tip(tip));
        }
      }
      
      if (options.debug) {
        const executeDuration = Number(process.hrtime.bigint() - executeStartTime) / 1000000;
        logger.debug(`ViewerBuildsCommandHandler execution completed in ${executeDuration.toFixed(2)}ms`);
      }
      
      return 0; // Success
    } catch (error) {
      // Only unexpected errors should reach here
      // Let the base command handle the error display
      this.handleError(error, options.debug);
      return 1; // Error
    }
  }
}