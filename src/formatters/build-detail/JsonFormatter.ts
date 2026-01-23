import { BaseBuildDetailFormatter, BuildDetail, BuildDetailFormatterOptions } from './Formatter.js';

export class JsonFormatter extends BaseBuildDetailFormatter {
  name = 'json';
  
  formatBuildDetail(buildData: BuildDetail | null, options?: BuildDetailFormatterOptions): string {
    if (options?.hasError || !buildData) {
      return JSON.stringify({
        error: true,
        errorType: options?.errorType || 'unknown',
        message: options?.errorMessage || 'An error occurred'
      }, null, 2);
    }
    
    const build = buildData.build;
    
    // Transform based on options
    let output: any = {
      id: build.id,
      number: build.number,
      state: build.state,
      branch: build.branch,
      message: build.message,
      commit: build.commit,
      url: build.url,
      createdAt: build.createdAt,
      startedAt: build.startedAt,
      finishedAt: build.finishedAt
    };
    
    // Add creator info
    if (build.createdBy) {
      output.createdBy = {
        name: build.createdBy.name,
        email: build.createdBy.email
      };
    }
    
    // Add organization and pipeline
    if (build.organization) {
      output.organization = {
        id: build.organization.id,
        name: build.organization.name,
        slug: build.organization.slug
      };
    }
    
    if (build.pipeline) {
      output.pipeline = {
        id: build.pipeline.id,
        name: build.pipeline.name,
        slug: build.pipeline.slug
      };
    }
    
    // Add jobs if requested or failed
    if (options?.jobs || options?.failed || options?.full) {
      const jobs = build.jobs?.edges || [];

      if (options?.failed) {
        // Filter to only failed jobs (both hard and soft failures)
        output.jobs = jobs
          .filter((j: any) => {
            const exitCode = j.node.exitStatus !== null ? parseInt(j.node.exitStatus, 10) : null;
            return j.node.state === 'FAILED' || (exitCode !== null && exitCode !== 0);
          })
          .map((j: any) => this.formatJob(j.node));
      } else {
        output.jobs = jobs.map((j: any) => this.formatJob(j.node));
      }

      // Add job statistics
      output.job_stats = this.calculateJobStats(jobs.map((j: any) => j.node));
    }
    
    // Add annotations if requested
    if (options?.annotations || options?.annotationsFull || options?.full) {
      const annotations = build.annotations?.edges || [];
      output.annotations = annotations.map((a: any) => ({
        id: a.node.id,
        style: a.node.style,
        context: a.node.context,
        body: options?.annotationsFull ? a.node.body?.html : undefined,
        createdAt: a.node.createdAt,
        updatedAt: a.node.updatedAt
      }));
    }
    
    // Add extra details if full
    if (options?.full) {
      if (build.pullRequest) {
        output.pullRequest = {
          id: build.pullRequest.id,
          number: build.pullRequest.number,
          repository: build.pullRequest.repository
        };
      }
      
      if (build.triggeredFrom) {
        output.triggeredFrom = {
          id: build.triggeredFrom.id,
          number: build.triggeredFrom.number,
          url: build.triggeredFrom.url,
          pipeline: build.triggeredFrom.pipeline
        };
      }
      
      if (build.blockedState) {
        output.blockedState = build.blockedState;
      }
    }
    
    return JSON.stringify(output, null, 2);
  }
  
  private formatJob(job: any): any {
    const formatted: any = {
      id: job.id,
      uuid: job.uuid,
      label: job.label,
      state: job.state,
      exitStatus: job.exitStatus,
      passed: job.passed,
      soft_failed: job.softFailed,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt
    };
    
    if (job.command) {
      formatted.command = job.command;
    }
    
    if (job.agent) {
      formatted.agent = {
        id: job.agent.id,
        name: job.agent.name,
        hostname: job.agent.hostname
      };
    }
    
    if (job.retried !== undefined) {
      formatted.retried = job.retried;
    }
    
    return formatted;
  }

  private calculateJobStats(jobs: any[]): any {
    const stats = {
      total: jobs.length,
      passed: 0,
      failed: 0,
      soft_failed: 0,
      running: 0,
      blocked: 0,
      skipped: 0
    };

    for (const job of jobs) {
      const state = job.state?.toUpperCase();

      if (job.exitStatus !== null && job.exitStatus !== undefined) {
        const exitCode = parseInt(job.exitStatus, 10);
        if (exitCode === 0) {
          stats.passed++;
        } else {
          if (job.softFailed === true) {
            stats.soft_failed++;
          } else {
            stats.failed++;
          }
        }
      } else if (state === 'RUNNING') {
        stats.running++;
      } else if (state === 'BLOCKED') {
        stats.blocked++;
      } else if (state === 'SKIPPED' || state === 'BROKEN' || state === 'CANCELED') {
        stats.skipped++;
      } else if (state === 'PASSED' || job.passed === true) {
        stats.passed++;
      } else if (state === 'FAILED' || job.passed === false) {
        if (job.softFailed === true) {
          stats.soft_failed++;
        } else {
          stats.failed++;
        }
      }
    }

    return stats;
  }

  formatError(action: string, error: any): string {
    return JSON.stringify({
      error: true,
      action,
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}
