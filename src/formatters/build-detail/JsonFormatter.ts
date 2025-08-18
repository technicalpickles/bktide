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
        // Filter to only failed jobs
        output.jobs = jobs
          .filter((j: any) => j.node.state === 'FAILED' || j.node.exitStatus !== 0)
          .map((j: any) => this.formatJob(j.node));
      } else {
        output.jobs = jobs.map((j: any) => this.formatJob(j.node));
      }
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
      soft_failed: job.soft_failed,
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
  
  formatError(action: string, error: any): string {
    return JSON.stringify({
      error: true,
      action,
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}
