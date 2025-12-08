import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { parseBuildkiteReference, BuildkiteReference } from '../utils/parseBuildkiteReference.js';
import { logger } from '../services/logger.js';
import { ShowBuild } from './ShowBuild.js';
import { PlainPipelineDetailFormatter, JsonPipelineDetailFormatter } from '../formatters/pipeline-detail/index.js';
import type { PipelineDetailData } from '../formatters/pipeline-detail/Formatter.js';
import { PlainStepLogsFormatter, JsonStepLogsFormatter } from '../formatters/step-logs/index.js';
import type { StepLogsData } from '../formatters/step-logs/Formatter.js';
import { SEMANTIC_COLORS } from '../ui/theme.js';
import * as fs from 'fs/promises';

export interface SmartShowOptions extends BaseCommandOptions {
  reference: string;
  // Log display options
  full?: boolean;
  lines?: number;
  save?: string;
}

export class SmartShow extends BaseCommand {
  static requiresToken = true;

  async execute(options: SmartShowOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting SmartShow command execution', options);
    }

    if (!options.reference) {
      logger.error('Reference is required');
      return 1;
    }

    try {
      // Parse the reference
      const ref = parseBuildkiteReference(options.reference);
      
      if (options.debug) {
        logger.debug('Parsed reference:', ref);
      }

      // Route based on reference type
      switch (ref.type) {
        case 'pipeline':
          return await this.showPipeline(ref, options);
        case 'build':
          return await this.showBuild(ref, options);
        case 'build-with-step':
          return await this.showBuildWithStep(ref, options);
        default:
          logger.error('Unknown reference type');
          return 1;
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error('Unknown error occurred');
      }
      return 1;
    }
  }

  private async showPipeline(
    ref: Extract<BuildkiteReference, { type: 'pipeline' }>,
    options: SmartShowOptions
  ): Promise<number> {
    try {
      // Initialize token first
      this.token = await BaseCommand.getToken(options);
      
      // Fetch pipeline details
      const pipeline = await this.client.getPipeline(ref.org, ref.pipeline);
      
      if (!pipeline) {
        logger.error(`Pipeline not found: ${ref.org}/${ref.pipeline}`);
        return 1;
      }

      // Fetch recent builds using pipeline-specific endpoint
      const builds = await this.restClient.getPipelineBuilds(ref.org, ref.pipeline, {
        per_page: '20',
      });

      // Prepare data for formatter
      const data: PipelineDetailData = {
        pipeline: {
          name: pipeline.name,
          slug: pipeline.slug,
          description: pipeline.description,
          defaultBranch: pipeline.defaultBranch,
          url: pipeline.url,
          repository: pipeline.repository,
        },
        recentBuilds: (builds || []).map((build: any) => ({
          number: build.number,
          state: build.state,
          branch: build.branch,
          message: build.message,
          startedAt: build.started_at,
          finishedAt: build.finished_at,
        })),
      };

      // Format and display
      const format = options.format || 'plain';
      let formatter;
      
      if (format === 'json' || format === 'alfred') {
        formatter = new JsonPipelineDetailFormatter({});
      } else {
        formatter = new PlainPipelineDetailFormatter({});
      }

      const output = formatter.format(data);
      console.log(output);

      return 0;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to fetch pipeline: ${error.message}`);
      }
      return 1;
    }
  }

  private async showBuild(
    ref: Extract<BuildkiteReference, { type: 'build' }>,
    options: SmartShowOptions
  ): Promise<number> {
    // Route to ShowBuild with enhanced defaults (--jobs --failed)
    const buildCommand = new ShowBuild(options);
    
    const buildOptions = {
      ...options,
      buildArg: `${ref.org}/${ref.pipeline}/${ref.buildNumber}`,
      jobs: true,
      failed: true,
    };

    return await buildCommand.execute(buildOptions);
  }

  private async showBuildWithStep(
    ref: Extract<BuildkiteReference, { type: 'build-with-step' }>,
    options: SmartShowOptions
  ): Promise<number> {
    try {
      // Initialize token first
      this.token = await BaseCommand.getToken(options);

      // Use REST API to get jobs with step.id field
      const jobs = await this.restClient.getBuildJobs(ref.org, ref.pipeline, ref.buildNumber);
      
      if (!jobs || jobs.length === 0) {
        logger.error(`Build not found: ${ref.org}/${ref.pipeline}/${ref.buildNumber}`);
        return 1;
      }

      // Find job by step ID (sid from URL) - step.id is different from job.id
      if (options.debug) {
        logger.debug(`Found ${jobs.length} jobs in build`);
        logger.debug(`Looking for step ID: ${ref.stepId}`);
        // Log first few jobs for debugging
        jobs.slice(0, 3).forEach((j: any) => {
          logger.debug(`  Job: id=${j.id}, step.id=${j.step?.id}, name=${j.name}`);
        });
      }
      const job = jobs.find((j: any) => j.step?.id === ref.stepId);
      
      if (!job) {
        logger.error(`Step not found in build #${ref.buildNumber}: ${ref.stepId}`);
        return 1;
      }

      // Use job.id (job UUID) for log fetching, not ref.stepId
      const logData = await this.restClient.getJobLog(ref.org, ref.pipeline, ref.buildNumber, job.id);

      // Parse log content
      const logLines = logData.content.split('\n');
      const totalLines = logLines.length;
      
      // Determine how many lines to display
      const linesToShow = options.full ? totalLines : (options.lines || 50);
      const startLine = Math.max(0, totalLines - linesToShow);
      const displayedLines = logLines.slice(startLine);

      // Save to file if requested
      if (options.save) {
        await fs.writeFile(options.save, logData.content);
        console.log(SEMANTIC_COLORS.success(`✓ Log saved to ${options.save} (${this.formatSize(logData.size)}, ${totalLines} lines)`));
      }

      // Prepare data for formatter using REST API fields
      const data: StepLogsData = {
        build: {
          org: ref.org,
          pipeline: ref.pipeline,
          number: ref.buildNumber,
          state: job.build?.state,
          startedAt: job.build?.started_at,
          finishedAt: job.build?.finished_at,
          url: job.build?.web_url,
        },
        step: {
          id: job.id,
          label: job.name,
          state: job.state,
          exitStatus: job.exit_status,
          startedAt: job.started_at,
          finishedAt: job.finished_at,
        },
        logs: {
          content: displayedLines.join('\n'),
          size: logData.size,
          totalLines,
          displayedLines: displayedLines.length,
          startLine,
        },
      };

      // Format and display (unless only saving)
      if (!options.save || options.format) {
        const format = options.format || 'plain';
        let formatter;
        
        if (format === 'json' || format === 'alfred') {
          formatter = new JsonStepLogsFormatter({ full: options.full, lines: options.lines });
        } else {
          formatter = new PlainStepLogsFormatter({ full: options.full, lines: options.lines });
        }

        const output = formatter.format(data);
        console.log(output);
      }

      return 0;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Failed to fetch step logs: ${error.message}`);
        
        if (error.message.includes('401') || error.message.includes('403')) {
          logger.error(`Your API token needs 'read_build_logs' scope to view logs.`);
          logger.error(`Update your token at: https://buildkite.com/user/api-access-tokens`);
        }
      }
      return 1;
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
