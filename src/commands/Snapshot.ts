import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import { parseBuildRef } from '../utils/parseBuildRef.js';
import { Progress } from '../ui/progress.js';
import { FormatterFactory, FormatterType, SnapshotData } from '../formatters/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface SnapshotOptions extends BaseCommandOptions {
  buildRef?: string;
  outputDir?: string;
  json?: boolean;
  failed?: boolean;
  all?: boolean;
}

interface StepResult {
  id: string;
  jobId: string;
  status: 'success' | 'failed';
  error?: string;
  message?: string;
  retryable?: boolean;
}

interface Manifest {
  version: number;
  buildRef: string;
  url: string;
  fetchedAt: string;
  complete: boolean;
  build: {
    status: string;
  };
  steps: StepResult[];
}

type ErrorCategory = 'rate_limited' | 'not_found' | 'permission_denied' | 'network_error' | 'unknown';

interface StepError {
  error: ErrorCategory;
  message: string;
  retryable: boolean;
}

/**
 * Categorize an error into a known category
 */
export function categorizeError(error: Error): StepError {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return { error: 'rate_limited', message: error.message, retryable: true };
  }
  if (message.includes('not found') || message.includes('404')) {
    return { error: 'not_found', message: error.message, retryable: false };
  }
  if (message.includes('permission') || message.includes('403') || message.includes('401')) {
    return { error: 'permission_denied', message: error.message, retryable: false };
  }
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return { error: 'network_error', message: error.message, retryable: true };
  }
  return { error: 'unknown', message: error.message, retryable: true };
}

/**
 * Generate a sanitized directory name for a step
 */
export function getStepDirName(index: number, label: string): string {
  const num = String(index + 1).padStart(2, '0');
  const sanitized = label
    .replace(/:[^:]+:/g, '')           // Remove emoji shortcodes like :hammer:
    .replace(/[^a-zA-Z0-9-]/g, '-')    // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-')               // Collapse multiple dashes
    .replace(/^-|-$/g, '')             // Trim leading/trailing dashes
    .toLowerCase()
    .slice(0, 50);                     // Limit length
  return `${num}-${sanitized || 'step'}`;
}

export class Snapshot extends BaseCommand {
  static requiresToken = true;

  async execute(options: SnapshotOptions): Promise<number> {
    if (options.debug) {
      logger.debug('Starting Snapshot command execution', options);
    }

    if (!options.buildRef) {
      logger.error('Build reference is required');
      return 1;
    }

    const format = options.format || 'plain';
    const spinner = Progress.spinner('Fetching build data…', { format });

    try {
      await this.ensureInitialized();

      // 1. Parse build reference
      const buildRef = parseBuildRef(options.buildRef);
      if (options.debug) {
        logger.debug('Parsed build reference:', buildRef);
      }

      // 2. Determine output directory
      const outputDir = this.getOutputDir(options, buildRef.org, buildRef.pipeline, buildRef.number);
      if (options.debug) {
        logger.debug('Output directory:', outputDir);
      }

      // 3. Fetch build data via GraphQL
      spinner.update('Fetching build metadata…');
      const buildSlug = `${buildRef.org}/${buildRef.pipeline}/${buildRef.number}`;
      const buildData = await this.client.getBuildSummaryWithAllJobs(buildSlug, {
        fetchAllJobs: true,
        onProgress: (fetched: number, total?: number) => {
          const totalStr = total ? `/${total}` : '';
          spinner.update(`Fetching jobs: ${fetched}${totalStr}…`);
        }
      });

      const build = buildData.build;
      const jobs = build.jobs?.edges || [];

      // 4. Create directory structure
      spinner.update('Creating directories…');
      await this.createDirectories(outputDir);

      // 5. Save build.json
      spinner.update('Saving build data…');
      await this.saveBuildJson(outputDir, build);

      // 6. Filter and fetch jobs
      // Filter to script jobs only (JobTypeCommand)
      const scriptJobs = jobs
        .map((edge: any) => edge.node)
        .filter((job: any) => job.__typename === 'JobTypeCommand' || !job.__typename);

      // Determine which jobs to fetch based on options
      // Default is --failed unless --all is specified
      const fetchAll = options.all === true;

      let jobsToFetch: any[];
      if (fetchAll) {
        jobsToFetch = scriptJobs;
      } else {
        // Filter to only failed jobs
        jobsToFetch = scriptJobs.filter((job: any) => this.isFailedJob(job));
      }

      const totalJobs = jobsToFetch.length;
      const stepResults: StepResult[] = [];

      // Stop the spinner before switching to progress bar
      spinner.stop();

      // Fetch logs for each job (if any) - use progress bar since we know the count
      if (totalJobs > 0) {
        const progressBar = Progress.bar({
          total: totalJobs,
          label: 'Fetching steps',
          format,
        });

        for (let i = 0; i < jobsToFetch.length; i++) {
          const job = jobsToFetch[i];
          const stepName = job.name || job.label || 'step';
          progressBar.update(i, `Fetching ${stepName}`);

          const stepResult = await this.fetchAndSaveStep(
            outputDir,
            buildRef.org,
            buildRef.pipeline,
            buildRef.number,
            job,
            stepResults.length,
            options.debug
          );
          stepResults.push(stepResult);
        }

        progressBar.complete(`Fetched ${totalJobs} step${totalJobs > 1 ? 's' : ''}`);
      }

      // 7. Write manifest
      const manifest = this.buildManifest(buildRef.org, buildRef.pipeline, buildRef.number, build, stepResults);
      await this.saveManifest(outputDir, manifest);

      // 8. Output using formatter
      const snapshotData: SnapshotData = {
        manifest,
        build,
        outputDir,
        scriptJobs,
        stepResults,
        fetchAll,
      };

      const formatter = FormatterFactory.getFormatter(
        FormatterType.SNAPSHOT,
        options.json ? 'json' : 'plain'
      );
      const output = (formatter as any).formatSnapshot(snapshotData, {
        tips: options.tips !== false
      });
      logger.console(output);

      return manifest.complete ? 0 : 1;
    } catch (error) {
      spinner.stop();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create snapshot: ${errorMessage}`);
      if (options.debug && error instanceof Error && error.stack) {
        logger.debug(error.stack);
      }
      return 1;
    }
  }

  private getOutputDir(options: SnapshotOptions, org: string, pipeline: string, buildNumber: number): string {
    const baseDir = options.outputDir || path.join(os.homedir(), '.bktide', 'snapshots');
    return path.join(baseDir, org, pipeline, String(buildNumber));
  }

  private async createDirectories(outputDir: string): Promise<void> {
    const stepsDir = path.join(outputDir, 'steps');
    await fs.mkdir(stepsDir, { recursive: true });
  }

  private async saveBuildJson(outputDir: string, build: any): Promise<void> {
    const buildPath = path.join(outputDir, 'build.json');
    await fs.writeFile(buildPath, JSON.stringify(build, null, 2), 'utf-8');
  }

  private async fetchAndSaveStep(
    outputDir: string,
    org: string,
    pipeline: string,
    buildNumber: number,
    job: any,
    stepIndex: number,
    debug?: boolean
  ): Promise<StepResult> {
    const stepDirName = getStepDirName(stepIndex, job.name || job.label || 'step');
    const stepDir = path.join(outputDir, 'steps', stepDirName);

    // Create step directory
    await fs.mkdir(stepDir, { recursive: true });

    // Save step.json (job metadata)
    const stepPath = path.join(stepDir, 'step.json');
    await fs.writeFile(stepPath, JSON.stringify(job, null, 2), 'utf-8');

    // Try to fetch and save log
    try {
      const logData = await this.restClient.getJobLog(org, pipeline, buildNumber, job.uuid);
      const logPath = path.join(stepDir, 'log.txt');
      await fs.writeFile(logPath, logData.content || '', 'utf-8');

      return {
        id: stepDirName,
        jobId: job.id,
        status: 'success',
      };
    } catch (error) {
      if (debug) {
        logger.debug(`Failed to fetch log for job ${job.id}:`, error);
      }

      const errorInfo = categorizeError(error instanceof Error ? error : new Error(String(error)));
      return {
        id: stepDirName,
        jobId: job.id,
        status: 'failed',
        error: errorInfo.error,
        message: errorInfo.message,
        retryable: errorInfo.retryable,
      };
    }
  }

  private buildManifest(
    org: string,
    pipeline: string,
    buildNumber: number,
    build: any,
    stepResults: StepResult[]
  ): Manifest {
    const allSuccess = stepResults.every(s => s.status === 'success');

    return {
      version: 1,
      buildRef: `${org}/${pipeline}/${buildNumber}`,
      url: `https://buildkite.com/${org}/${pipeline}/builds/${buildNumber}`,
      fetchedAt: new Date().toISOString(),
      complete: allSuccess,
      build: {
        status: build.state || 'unknown',
      },
      steps: stepResults,
    };
  }

  private async saveManifest(outputDir: string, manifest: Manifest): Promise<void> {
    const manifestPath = path.join(outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /**
   * Check if a job is considered failed
   * Failed states: failed, timed_out, or non-zero exit status
   */
  private isFailedJob(job: any): boolean {
    const state = job.state?.toUpperCase();

    // Check state-based failure
    if (state === 'FAILED' || state === 'TIMED_OUT') {
      return true;
    }

    // Check exit status (non-zero means failure, including soft failures)
    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      const exitCode = parseInt(job.exitStatus, 10);
      return exitCode !== 0;
    }

    // Check passed field
    if (job.passed === false) {
      return true;
    }

    return false;
  }
}
