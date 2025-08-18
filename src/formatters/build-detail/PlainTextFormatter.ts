import { BaseBuildDetailFormatter, BuildDetail, BuildDetailFormatterOptions } from './Formatter.js';
import { formatDistanceToNow } from 'date-fns';
import { htmlToText } from 'html-to-text';
import { 
  formatEmptyState,
  formatError,
  SEMANTIC_COLORS,
  formatBuildStatus
} from '../../ui/theme.js';

// Buildkite emoji mappings
const BUILDKITE_EMOJI: Record<string, string> = {
  // Testing frameworks
  ':rspec:': '🧪',
  ':jest:': '🃏',
  ':eslint:': '📝',
  ':rubocop:': '👮',
  ':cypress:': '🌲',
  ':playwright:': '🎭',
  
  // Tools
  ':docker:': '🐳',
  ':kubernetes:': '☸️',
  ':helm:': '⚓',
  ':terraform:': '🏗️',
  ':aws:': '☁️',
  ':github:': '🐙',
  ':git:': '📦',
  
  // Languages
  ':ruby:': '💎',
  ':javascript:': '📜',
  ':typescript:': '📘',
  ':python:': '🐍',
  ':go:': '🐹',
  ':rust:': '🦀',
  
  // Status/Actions
  ':pipeline:': '🔧',
  ':console:': '💻',
  ':database:': '🗄️',
  ':seeds:': '🌱',
  ':package:': '📦',
  ':rocket:': '🚀',
  ':fire:': '🔥',
  ':warning:': '⚠️',
  ':error:': '❌',
  ':success:': '✅',
  ':info:': 'ℹ️',
  
  // Standard emoji pass-through (common ones)
  ':smile:': '😊',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':star:': '⭐',
  ':heart:': '❤️',
  ':boom:': '💥',
  ':zap:': '⚡',
};

export class PlainTextFormatter extends BaseBuildDetailFormatter {
  name = 'plain-text';
  
  private parseEmoji(text: string): string {
    if (!text) return text;
    return text.replace(/:(\w+):/g, (match) => {
      return BUILDKITE_EMOJI[match] || match;
    });
  }
  
  formatBuildDetail(buildData: BuildDetail | null, options?: BuildDetailFormatterOptions): string {
    // Handle error cases first
    if (options?.hasError || !buildData) {
      return this.formatErrorState(options);
    }
    
    const build = buildData.build;
    
    // Choose display mode based on options
    if (options?.summary) {
      return this.formatSummaryLine(build);
    }
    
    if (options?.full) {
      return this.formatFullDetails(build, options);
    }
    
    // Default: contextual display based on state
    switch (build.state) {
      case 'FAILED':
        return this.formatFailedBuild(build, options);
      case 'RUNNING':
        return this.formatRunningBuild(build, options);
      case 'BLOCKED':
        return this.formatBlockedBuild(build, options);
      case 'PASSED':
        return this.formatPassedBuild(build, options);
      case 'CANCELED':
        return this.formatCanceledBuild(build, options);
      default:
        return this.formatDefaultBuild(build, options);
    }
  }
  
  private formatErrorState(options?: BuildDetailFormatterOptions): string {
    if (options?.errorType === 'not_found') {
      return formatEmptyState(
        'Build not found',
        ['Check the build reference format', 'Verify the build exists']
      );
    }
    
    return formatError(options?.errorMessage || 'Unknown error');
  }
  
  private formatSummaryLine(build: any): string {
    const status = this.getStatusIcon(build.state);
    const duration = this.formatDuration(build);
    const age = this.formatAge(build.createdAt);
    
    return `${status} #${build.number} ${build.state.toLowerCase()} • ${duration} • ${build.branch} • ${age}`;
  }
  
  private formatPassedBuild(build: any, options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Header line
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommitInfo(build));
    
    // Show annotations summary if present
    if (build.annotations?.edges?.length > 0) {
      lines.push('');
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
      
      if (!options?.annotations) {
        lines.push(SEMANTIC_COLORS.dim(`→ bin/bktide build ${build.number} --annotations  # view annotations`));
      }
    }
    
    // Show annotations detail if requested
    if (options?.annotations) {
      lines.push('');
      lines.push(this.formatAnnotationDetails(build.annotations.edges, options));
    }
    
    return lines.join('\n');
  }
  
  private formatFailedBuild(build: any, options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Header line
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommitInfo(build));
    lines.push('');
    
    // Failed jobs summary
    const failedJobs = this.getFailedJobs(build.jobs?.edges);
    if (failedJobs.length > 0) {
      lines.push(this.formatFailedJobsSummary(failedJobs));
    }
    
    // Annotation summary
    if (build.annotations?.edges?.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Show detailed job info if requested
    if (options?.jobs || options?.failed) {
      lines.push('');
      lines.push(this.formatJobDetails(build.jobs?.edges, options));
    }
    
    // Show annotations detail if requested
    if (options?.annotations) {
      lines.push('');
      lines.push(this.formatAnnotationDetails(build.annotations.edges, options));
    }
    
    // Hints for more info (no Tips label)
    if (!options?.failed && failedJobs.length > 0) {
      lines.push('');
      lines.push(SEMANTIC_COLORS.dim(`→ bin/bktide build ${build.number} --failed  # show failure details`));
    }
    if (!options?.annotations && build.annotations?.edges?.length > 0) {
      lines.push(SEMANTIC_COLORS.dim(`→ bin/bktide build ${build.number} --annotations  # view annotations`));
    }
    
    return lines.join('\n');
  }
  
  private formatRunningBuild(build: any, options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Header line
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommitInfo(build));
    lines.push('');
    
    // Progress information
    const jobStats = this.getJobStats(build.jobs?.edges);
    lines.push(`Progress: ${SEMANTIC_COLORS.count(String(jobStats.completed))}/${jobStats.total} complete, ${SEMANTIC_COLORS.info(String(jobStats.running))} running, ${jobStats.queued} queued`);
    
    // Show running jobs
    const runningJobs = this.getRunningJobs(build.jobs?.edges);
    if (runningJobs.length > 0) {
      const labels = runningJobs.map(j => this.parseEmoji(j.node.label)).join(', ');
      lines.push(`${SEMANTIC_COLORS.info('Running')}: ${labels}`);
    }
    
    // Show job details if requested
    if (options?.jobs) {
      lines.push('');
      lines.push(this.formatJobDetails(build.jobs?.edges, options));
    }
    
    return lines.join('\n');
  }
  
  private formatBlockedBuild(build: any, options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Header line
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommitInfo(build));
    lines.push('');
    
    // Blocked information
    const blockedJobs = this.getBlockedJobs(build.jobs?.edges);
    if (blockedJobs.length > 0) {
      lines.push(`🚫 Blocked: "${blockedJobs[0].node.label}" (manual unblock required)`);
    }
    
    // Show jobs summary
    const jobStats = this.getJobStats(build.jobs?.edges);
    if (jobStats.completed > 0) {
      lines.push(`✅ ${jobStats.completed} jobs passed before block`);
    }
    
    // Show job details if requested
    if (options?.jobs) {
      lines.push('');
      lines.push(this.formatJobDetails(build.jobs?.edges, options));
    }
    
    return lines.join('\n');
  }
  
  private formatCanceledBuild(build: any, options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Header line
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommitInfo(build));
    lines.push('');
    
    // Canceled information
    if (build.createdBy) {
      const creator = build.createdBy.name || build.createdBy.email;
      lines.push(`Canceled by: ${creator}`);
    }
    
    // Show jobs summary
    const jobStats = this.getJobStats(build.jobs?.edges);
    lines.push(`Completed: ${jobStats.completed}/${jobStats.total} jobs before cancellation`);
    
    // Show job details if requested
    if (options?.jobs) {
      lines.push('');
      lines.push(this.formatJobDetails(build.jobs?.edges, options));
    }
    
    return lines.join('\n');
  }
  
  private formatDefaultBuild(build: any, options?: BuildDetailFormatterOptions): string {
    return this.formatPassedBuild(build, options);
  }
  
  private formatFullDetails(build: any, options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Full header information
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommitInfo(build));
    lines.push('');
    
    // Build metadata
    lines.push('Build Details:');
    lines.push(`  URL: ${build.url}`);
    lines.push(`  Organization: ${build.organization?.name || 'Unknown'}`);
    lines.push(`  Pipeline: ${build.pipeline?.name || 'Unknown'}`);
    
    if (build.pullRequest) {
      lines.push(`  Pull Request: #${build.pullRequest.number}`);
    }
    
    if (build.triggeredFrom) {
      lines.push(`  Triggered from: ${build.triggeredFrom.pipeline?.name} #${build.triggeredFrom.number}`);
    }
    
    lines.push('');
    
    // Jobs section
    lines.push('Jobs:');
    lines.push(this.formatJobDetails(build.jobs?.edges, { ...options, full: true }));
    
    // Annotations section
    if (build.annotations?.edges?.length > 0) {
      lines.push('');
      lines.push('Annotations:');
      lines.push(this.formatAnnotationDetails(build.annotations.edges, { ...options, annotationsFull: true }));
    }
    
    return lines.join('\n');
  }
  
  private formatHeader(build: any): string {
    const status = this.getStatusIcon(build.state);
    const stateFormatted = formatBuildStatus(build.state, { useSymbol: false });
    const duration = this.formatDuration(build);
    const age = this.formatAge(build.createdAt);
    const branch = SEMANTIC_COLORS.identifier(build.branch);
    
    return `${status} ${SEMANTIC_COLORS.label(`#${build.number}`)} ${stateFormatted} • ${duration} • ${branch} • ${age}`;
  }
  
  private formatCommitInfo(build: any): string {
    const shortSha = build.commit ? build.commit.substring(0, 7) : 'unknown';
    const message = build.message || 'No commit message';
    const truncatedMessage = message.length > 60 ? message.substring(0, 57) + '...' : message;
    
    return `   "${truncatedMessage}" (${shortSha})`;
  }
  
  private formatAnnotationSummary(annotations: any[]): string {
    const counts = this.countAnnotationsByStyle(annotations);
    const parts = [];
    
    if (counts.ERROR > 0) parts.push(SEMANTIC_COLORS.error(`${counts.ERROR} error${counts.ERROR > 1 ? 's' : ''}`));
    if (counts.WARNING > 0) parts.push(SEMANTIC_COLORS.warning(`${counts.WARNING} warning${counts.WARNING > 1 ? 's' : ''}`));
    if (counts.INFO > 0) parts.push(SEMANTIC_COLORS.info(`${counts.INFO} info`));
    if (counts.SUCCESS > 0) parts.push(SEMANTIC_COLORS.success(`${counts.SUCCESS} success`));
    
    const total = annotations.length;
    return `📝 ${SEMANTIC_COLORS.count(String(total))} annotation${total > 1 ? 's' : ''}: ${parts.join(', ')}`;
  }
  
  private formatAnnotationDetails(annotations: any[], options?: BuildDetailFormatterOptions): string {
    const lines: string[] = [];
    
    // Group annotations by style
    const grouped = this.groupAnnotationsByStyle(annotations);
    
    for (const [style, items] of Object.entries(grouped)) {
      for (const annotation of items) {
        const icon = this.getAnnotationIcon(style);
        const context = annotation.node.context || 'default';
        
        if (options?.annotationsFull) {
          // Full content
          lines.push(`${icon} ${style} [${context}]:`);
          const body = htmlToText(annotation.node.body?.html || '', {
            wordwrap: 80,
            preserveNewlines: true
          });
          lines.push(body.split('\n').map(l => `   ${l}`).join('\n'));
          lines.push('');
        } else {
          // Summary only
          lines.push(`${icon} ${style} [${context}]`);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  private formatJobDetails(jobs: any[], options?: BuildDetailFormatterOptions): string {
    if (!jobs || jobs.length === 0) {
      return 'No jobs found';
    }
    
    const lines: string[] = [];
    const jobStats = this.getJobStats(jobs);
    
    // Summary line
    const parts = [];
    if (jobStats.passed > 0) parts.push(`✅ ${jobStats.passed} passed`);
    if (jobStats.failed > 0) parts.push(`❌ ${jobStats.failed} failed`);
    if (jobStats.running > 0) parts.push(`🔄 ${jobStats.running} running`);
    if (jobStats.blocked > 0) parts.push(`⏸️ ${jobStats.blocked} blocked`);
    if (jobStats.skipped > 0) parts.push(`⏭️ ${jobStats.skipped} skipped`);
    
    lines.push(`Jobs: ${parts.join('  ')}`);
    lines.push('');
    
    // Filter jobs based on options
    let filteredJobs = jobs;
    if (options?.failed) {
      filteredJobs = this.getFailedJobs(jobs);
    }
    
    // Group jobs by state
    const grouped = this.groupJobsByState(filteredJobs);
    
    for (const [state, stateJobs] of Object.entries(grouped)) {
      if (stateJobs.length === 0) continue;
      
      const icon = this.getJobStateIcon(state);
      const stateColored = this.colorizeJobState(state);
      lines.push(`${icon} ${stateColored} (${SEMANTIC_COLORS.count(String(stateJobs.length))}):`);
      
      for (const job of stateJobs) {
        const label = this.parseEmoji(job.node.label);
        const duration = this.formatJobDuration(job.node);
        const exitCode = job.node.exitStatus ? `, exit ${job.node.exitStatus}` : '';
        lines.push(`  ${label} (${duration}${exitCode})`);
        
        if (options?.full && job.node.agent) {
          lines.push(`    ${SEMANTIC_COLORS.dim(`Agent: ${job.node.agent.name || job.node.agent.hostname}`)}`);
        }
      }
      lines.push('');
    }
    
    return lines.join('\n').trim();
  }
  
  private formatFailedJobsSummary(failedJobs: any[]): string {
    const lines: string[] = [];
    
    // Group identical jobs by label
    const jobGroups = this.groupJobsByLabel(failedJobs);
    
    // Show first 10 unique job types
    const displayGroups = jobGroups.slice(0, 10);
    
    for (const group of displayGroups) {
      const label = this.parseEmoji(group.label);
      if (group.count === 1) {
        const duration = this.formatJobDuration(group.jobs[0].node);
        lines.push(`   ${SEMANTIC_COLORS.error('Failed')}: ${label} - ran ${duration}`);
      } else {
        // Multiple jobs with same label
        const statusInfo = group.allNotStarted 
          ? 'all not started' 
          : group.exitCodes.length > 0 
            ? `exit codes: ${group.exitCodes.join(', ')}`
            : 'various states';
        lines.push(`   ${SEMANTIC_COLORS.error('Failed')}: ${label} (${SEMANTIC_COLORS.count(String(group.count))} jobs, ${statusInfo})`);
      }
    }
    
    // Add summary if there are more job types
    const remaining = jobGroups.length - displayGroups.length;
    if (remaining > 0) {
      lines.push(`   ${SEMANTIC_COLORS.muted(`...and ${remaining} more job types`)}`);
    }
    
    return lines.join('\n');
  }
  
  private groupJobsByLabel(jobs: any[]): any[] {
    const groups = new Map<string, any>();
    
    for (const job of jobs) {
      const label = job.node.label || 'Unnamed job';
      if (!groups.has(label)) {
        groups.set(label, {
          label,
          count: 0,
          jobs: [],
          exitCodes: new Set<number>(),
          allNotStarted: true
        });
      }
      
      const group = groups.get(label)!;
      group.count++;
      group.jobs.push(job);
      
      if (job.node.exitStatus) {
        group.exitCodes.add(job.node.exitStatus);
      }
      
      if (job.node.startedAt) {
        group.allNotStarted = false;
      }
    }
    
    // Convert to array and sort by count (most failures first)
    return Array.from(groups.values())
      .map(g => ({ ...g, exitCodes: Array.from(g.exitCodes) }))
      .sort((a, b) => b.count - a.count);
  }
  
  private formatDuration(build: any): string {
    if (!build.startedAt) {
      return 'not started';
    }
    
    const start = new Date(build.startedAt);
    const end = build.finishedAt ? new Date(build.finishedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (build.state === 'RUNNING') {
      return `${minutes}m ${seconds}s elapsed`;
    }
    
    return `${minutes}m ${seconds}s`;
  }
  
  private formatJobDuration(job: any): string {
    if (!job.startedAt) {
      return 'not started';
    }
    
    const start = new Date(job.startedAt);
    const end = job.finishedAt ? new Date(job.finishedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  }
  
  private formatAge(createdAt: string): string {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  }
  
  private colorizeJobState(state: string): string {
    switch (state.toLowerCase()) {
      case 'failed':
        return SEMANTIC_COLORS.error(state);
      case 'passed':
        return SEMANTIC_COLORS.success(state);
      case 'running':
        return SEMANTIC_COLORS.info(state);
      case 'blocked':
        return SEMANTIC_COLORS.warning(state);
      case 'skipped':
      case 'canceled':
        return SEMANTIC_COLORS.muted(state);
      default:
        return state;
    }
  }
  
  private getStatusIcon(state: string): string {
    const icons: Record<string, string> = {
      'PASSED': '✅',
      'FAILED': '❌',
      'RUNNING': '🔄',
      'BLOCKED': '⏸️',
      'CANCELED': '🚫',
      'SCHEDULED': '📅',
      'SKIPPED': '⏭️'
    };
    
    return icons[state] || '❓';
  }
  
  private getJobStateIcon(state: string): string {
    const icons: Record<string, string> = {
      'passed': '✅',
      'failed': '❌',
      'running': '🔄',
      'blocked': '⏸️',
      'canceled': '🚫',
      'scheduled': '📅',
      'skipped': '⏭️'
    };
    
    return icons[state.toLowerCase()] || '❓';
  }
  
  private getAnnotationIcon(style: string): string {
    const icons: Record<string, string> = {
      'ERROR': '❌',
      'WARNING': '⚠️',
      'INFO': 'ℹ️',
      'SUCCESS': '✅'
    };
    
    return icons[style.toUpperCase()] || '📝';
  }
  
  private getJobStats(jobs: any[]): any {
    const stats = {
      total: jobs?.length || 0,
      passed: 0,
      failed: 0,
      running: 0,
      blocked: 0,
      skipped: 0,
      queued: 0,
      completed: 0
    };
    
    if (!jobs) return stats;
    
    for (const job of jobs) {
      const state = job.node.state?.toUpperCase() || '';
      
      if (state === 'PASSED' || (job.node.passed === true && state !== 'BROKEN')) {
        stats.passed++;
        stats.completed++;
      } else if (state === 'FAILED' || state === 'BROKEN' || (job.node.exitStatus && job.node.exitStatus !== 0) || job.node.passed === false) {
        stats.failed++;
        stats.completed++;
      } else if (state === 'RUNNING') {
        stats.running++;
      } else if (state === 'BLOCKED') {
        stats.blocked++;
      } else if (state === 'SKIPPED' || state === 'CANCELED') {
        stats.skipped++;
        stats.completed++;
      } else if (state === 'SCHEDULED' || state === 'ASSIGNED') {
        stats.queued++;
      }
    }
    
    return stats;
  }
  
  private getFailedJobs(jobs: any[]): any[] {
    if (!jobs) return [];
    
    return jobs.filter(job => {
      const state = job.node.state?.toUpperCase();
      return state === 'FAILED' || state === 'BROKEN' || (job.node.exitStatus && job.node.exitStatus !== 0) || job.node.passed === false;
    });
  }
  
  private getRunningJobs(jobs: any[]): any[] {
    if (!jobs) return [];
    
    return jobs.filter(job => job.node.state?.toLowerCase() === 'running');
  }
  
  private getBlockedJobs(jobs: any[]): any[] {
    if (!jobs) return [];
    
    return jobs.filter(job => job.node.state?.toLowerCase() === 'blocked');
  }
  
  private groupJobsByState(jobs: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {
      'Failed': [],
      'Passed': [],
      'Running': [],
      'Blocked': [],
      'Skipped': []
    };
    
    if (!jobs) return grouped;
    
    for (const job of jobs) {
      const state = job.node.state?.toUpperCase() || '';
      
      if (state === 'FAILED' || state === 'BROKEN' || (job.node.exitStatus && job.node.exitStatus !== 0) || job.node.passed === false) {
        grouped['Failed'].push(job);
      } else if (state === 'PASSED' || (job.node.passed === true && state !== 'BROKEN')) {
        grouped['Passed'].push(job);
      } else if (state === 'RUNNING') {
        grouped['Running'].push(job);
      } else if (state === 'BLOCKED') {
        grouped['Blocked'].push(job);
      } else if (state === 'SKIPPED' || state === 'CANCELED') {
        grouped['Skipped'].push(job);
      }
    }
    
    return grouped;
  }
  
  private countAnnotationsByStyle(annotations: any[]): Record<string, number> {
    const counts: Record<string, number> = {
      ERROR: 0,
      WARNING: 0,
      INFO: 0,
      SUCCESS: 0
    };
    
    for (const annotation of annotations) {
      const style = annotation.node.style?.toUpperCase() || 'INFO';
      if (style in counts) {
        counts[style]++;
      }
    }
    
    return counts;
  }
  
  private groupAnnotationsByStyle(annotations: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const annotation of annotations) {
      const style = annotation.node.style?.toUpperCase() || 'INFO';
      if (!grouped[style]) {
        grouped[style] = [];
      }
      grouped[style].push(annotation);
    }
    
    return grouped;
  }
  
  formatError(action: string, error: any): string {
    return formatError(action, error);
  }
}
