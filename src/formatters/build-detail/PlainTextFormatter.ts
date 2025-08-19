import { BaseBuildDetailFormatter, BuildDetail, BuildDetailFormatterOptions } from './Formatter.js';
import { formatDistanceToNow } from 'date-fns';
import { htmlToText } from 'html-to-text';
import { 
  formatEmptyState,
  formatError,
  SEMANTIC_COLORS,
  formatBuildStatus,
  formatTips,
  TipStyle,
  getStateIcon,
  getAnnotationIcon,
  getProgressIcon,
  BUILD_STATUS_THEME
} from '../../ui/theme.js';

// Standard emoji mappings only
// Only map universally recognized emoji codes, not Buildkite-specific ones
const STANDARD_EMOJI: Record<string, string> = {
  // Faces & emotions
  ':smile:': '😊',
  ':grin:': '😁',
  ':joy:': '😂',
  ':laughing:': '😆',
  ':blush:': '😊',
  ':heart_eyes:': '😍',
  ':sob:': '😭',
  ':cry:': '😢',
  ':angry:': '😠',
  ':rage:': '😡',
  ':thinking:': '🤔',
  ':confused:': '😕',
  ':neutral_face:': '😐',
  
  // Hands & gestures
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':clap:': '👏',
  ':wave:': '👋',
  ':raised_hand:': '✋',
  ':ok_hand:': '👌',
  ':pray:': '🙏',
  ':muscle:': '💪',
  ':point_left:': '👈',
  ':point_right:': '👉',
  ':point_up:': '👆',
  ':point_down:': '👇',
  
  // Objects & symbols
  ':heart:': '❤️',
  ':broken_heart:': '💔',
  ':star:': '⭐',
  ':sparkles:': '✨',
  ':boom:': '💥',
  ':fire:': '🔥',
  ':zap:': '⚡',
  ':rocket:': '🚀',
  ':sun:': '☀️',
  ':moon:': '🌙',
  ':cloud:': '☁️',
  ':umbrella:': '☔',
  ':snowflake:': '❄️',
  
  // Status symbols
  ':white_check_mark:': '✅',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':exclamation:': '❗',
  ':question:': '❓',
  ':heavy_plus_sign:': '➕',
  ':heavy_minus_sign:': '➖',
  ':heavy_check_mark:': '✔️',
  
  // Common tools/tech (universally recognized)
  ':computer:': '💻',
  ':iphone:': '📱',
  ':email:': '📧',
  ':package:': '📦',
  ':lock:': '🔒',
  ':key:': '🔑',
  ':mag:': '🔍',
  ':bulb:': '💡',
  ':books:': '📚',
  ':memo:': '📝',
  ':pencil:': '✏️',
  ':art:': '🎨',
  ':camera:': '📷',
  ':movie_camera:': '🎥',
  ':musical_note:': '🎵',
  ':bell:': '🔔',
  ':link:': '🔗',
  ':paperclip:': '📎',
  ':hourglass:': '⏳',
  ':alarm_clock:': '⏰',
  ':stopwatch:': '⏱️',
  ':timer_clock:': '⏲️',
  ':calendar:': '📅',
  ':date:': '📅',
};

export class PlainTextFormatter extends BaseBuildDetailFormatter {
  name = 'plain-text';
  
  private parseEmoji(text: string): string {
    if (!text) return text;
    // Only replace standard emoji codes, leave Buildkite-specific ones as-is
    return text.replace(/:[\w_]+:/g, (match) => {
      return STANDARD_EMOJI[match] || match;
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
    const statusIcon = this.getStatusIcon(build.state);
    const coloredIcon = this.colorizeStatusIcon(statusIcon, build.state);
    const duration = this.formatDuration(build);
    const age = this.formatAge(build.createdAt);
    const stateFormatted = formatBuildStatus(build.state, { useSymbol: false });
    const branch = SEMANTIC_COLORS.identifier(build.branch);
    
    return `${coloredIcon} ${SEMANTIC_COLORS.label(`#${build.number}`)} ${stateFormatted} • ${duration} • ${branch} • ${age}`;
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
        lines.push('');
        const tips = formatTips(
          ['Use --annotations to view annotation details'],
          TipStyle.GROUPED
        );
        lines.push(tips);
      }
    }
    
    // Show annotations detail if requested
    if (options?.annotations) {
      lines.push('');
      lines.push(this.formatAnnotationDetails(build.annotations.edges));
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
    const allHints: string[] = [];
    
    if (failedJobs.length > 0) {
      const { summary, hints } = this.formatFailedJobsSummaryWithHints(failedJobs, options);
      lines.push(summary);
      allHints.push(...hints);
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
      lines.push(this.formatAnnotationDetails(build.annotations.edges));
    }
    
    // Collect all hints for more info
    if (!options?.failed && failedJobs.length > 0) {
      allHints.push('Use --failed to show failure details');
    }
    if (!options?.annotations && build.annotations?.edges?.length > 0) {
      allHints.push('Use --annotations to view annotation details');
    }
    
    // Display all hints together
    if (allHints.length > 0) {
      lines.push('');
      lines.push(formatTips(allHints, TipStyle.GROUPED));
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
    
    // Annotation summary
    if (build.annotations?.edges?.length > 0) {
      lines.push('');
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Show job details if requested
    if (options?.jobs) {
      lines.push('');
      lines.push(this.formatJobDetails(build.jobs?.edges, options));
    }
    
    // Show annotations detail if requested
    if (options?.annotations) {
      lines.push('');
      lines.push(this.formatAnnotationDetails(build.annotations.edges));
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
      lines.push(`${getProgressIcon('BLOCKED_MESSAGE')} Blocked: "${blockedJobs[0].node.label}" (manual unblock required)`);
    }
    
    // Show jobs summary
    const jobStats = this.getJobStats(build.jobs?.edges);
    if (jobStats.completed > 0) {
      lines.push(`${getStateIcon('PASSED')} ${jobStats.completed} jobs passed before block`);
    }
    
    // Annotation summary
    if (build.annotations?.edges?.length > 0) {
      lines.push('');
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Show job details if requested
    if (options?.jobs) {
      lines.push('');
      lines.push(this.formatJobDetails(build.jobs?.edges, options));
    }
    
    // Show annotations detail if requested
    if (options?.annotations) {
      lines.push('');
      lines.push(this.formatAnnotationDetails(build.annotations.edges));
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
      // Try to construct PR URL from repository URL
      const repoUrl = build.pipeline?.repository?.url;
      if (repoUrl && repoUrl.includes('github.com')) {
        // Extract owner/repo from various GitHub URL formats
        const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
        if (match && build.pullRequest.id) {
          // Extract PR number from GraphQL ID if possible
          // GitHub PR IDs often contain the number
          const prUrl = `https://github.com/${match[1]}/${match[2]}/pull/${build.pullRequest.id}`;
          lines.push(`  Pull Request: ${SEMANTIC_COLORS.url(prUrl)}`);
        } else {
          lines.push(`  Pull Request: ${build.pullRequest.id}`);
        }
      } else {
        lines.push(`  Pull Request: ${build.pullRequest.id}`);
      }
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
      lines.push(this.formatAnnotationDetails(build.annotations.edges));
    }
    
    return lines.join('\n');
  }
  
  private formatHeader(build: any): string {
    const statusIcon = this.getStatusIcon(build.state);
    // Apply appropriate color to the icon based on the state
    const coloredIcon = this.colorizeStatusIcon(statusIcon, build.state);
    const stateFormatted = formatBuildStatus(build.state, { useSymbol: false });
    const duration = this.formatDuration(build);
    const age = this.formatAge(build.createdAt);
    const branch = SEMANTIC_COLORS.identifier(build.branch);
    
    return `${coloredIcon} ${SEMANTIC_COLORS.label(`#${build.number}`)} ${stateFormatted} • ${duration} • ${branch} • ${age}`;
  }
  
  private formatCommitInfo(build: any): string {
    const shortSha = build.commit ? build.commit.substring(0, 7) : 'unknown';
    const message = build.message || 'No commit message';
    const truncatedMessage = message.length > 60 ? message.substring(0, 57) + '...' : message;
    
    return `   "${truncatedMessage}" (${shortSha})`;
  }
  
  private formatAnnotationSummary(annotations: any[]): string {
    if (!annotations || annotations.length === 0) {
      return '';
    }
    
    const lines: string[] = [];
    const total = annotations.length;
    
    // Header with count
    const counts = this.countAnnotationsByStyle(annotations);
    const countParts = [];
    if (counts.ERROR > 0) countParts.push(SEMANTIC_COLORS.error(`${counts.ERROR} error${counts.ERROR > 1 ? 's' : ''}`));
    if (counts.WARNING > 0) countParts.push(SEMANTIC_COLORS.warning(`${counts.WARNING} warning${counts.WARNING > 1 ? 's' : ''}`));
    if (counts.INFO > 0) countParts.push(SEMANTIC_COLORS.info(`${counts.INFO} info`));
    if (counts.SUCCESS > 0) countParts.push(SEMANTIC_COLORS.success(`${counts.SUCCESS} success`));
    
    lines.push(`${getAnnotationIcon('DEFAULT')} ${SEMANTIC_COLORS.count(String(total))} annotation${total > 1 ? 's' : ''}: ${countParts.join(', ')}`);
    
    // List each annotation with style and context
    const grouped = this.groupAnnotationsByStyle(annotations);
    const styleOrder = ['ERROR', 'WARNING', 'INFO', 'SUCCESS'];
    
    for (const style of styleOrder) {
      if (grouped[style]) {
        for (const annotation of grouped[style]) {
          const icon = this.getAnnotationIcon(style);
          const context = annotation.node.context || 'default';
          const styleColored = this.colorizeAnnotationStyle(style);
          lines.push(`   ${icon} ${styleColored}: ${context}`);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  private formatAnnotationDetails(annotations: any[]): string {
    const lines: string[] = [];
    
    // Group annotations by style
    const grouped = this.groupAnnotationsByStyle(annotations);
    const styleOrder = ['ERROR', 'WARNING', 'INFO', 'SUCCESS'];
    
    for (const style of styleOrder) {
      if (grouped[style]) {
        for (const annotation of grouped[style]) {
          const icon = this.getAnnotationIcon(style);
          const context = annotation.node.context || 'default';
          const styleColored = this.colorizeAnnotationStyle(style);
          
          // When showing annotation details, always show the body text
          lines.push(`${icon} ${styleColored}: ${context}`);
          const body = htmlToText(annotation.node.body?.html || '', {
            wordwrap: 80,
            preserveNewlines: true
          });
          lines.push(body.split('\n').map(l => `   ${l}`).join('\n'));
          lines.push('');
        }
      }
    }
    
    return lines.join('\n').trim();
  }
  
  private formatJobDetails(jobs: any[], options?: BuildDetailFormatterOptions): string {
    if (!jobs || jobs.length === 0) {
      return 'No jobs found';
    }
    
    const lines: string[] = [];
    const jobStats = this.getJobStats(jobs);
    
    // Summary line
    const parts = [];
    if (jobStats.passed > 0) parts.push(`${getStateIcon('PASSED')} ${jobStats.passed} passed`);
    if (jobStats.failed > 0) parts.push(`${getStateIcon('FAILED')} ${jobStats.failed} failed`);
    if (jobStats.running > 0) parts.push(`${getStateIcon('RUNNING')} ${jobStats.running} running`);
    if (jobStats.blocked > 0) parts.push(`${getStateIcon('BLOCKED')} ${jobStats.blocked} blocked`);
    if (jobStats.skipped > 0) parts.push(`${getStateIcon('SKIPPED')} ${jobStats.skipped} skipped`);
    
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
        
        // Basic job line
        lines.push(`  ${label} (${duration})`);
        
        // Show additional details if --jobs or --full
        if (options?.jobs || options?.full) {
          // Timing details
          if (job.node.startedAt) {
            const startTime = new Date(job.node.startedAt).toLocaleTimeString();
            const endTime = job.node.finishedAt 
              ? new Date(job.node.finishedAt).toLocaleTimeString()
              : 'still running';
            lines.push(`    ${SEMANTIC_COLORS.dim(`${getProgressIcon('TIMING')}  ${startTime} → ${endTime}`)}`);
          }
          
          // Parallel group info
          if (job.node.parallelGroupIndex !== undefined && job.node.parallelGroupTotal) {
            lines.push(`    ${SEMANTIC_COLORS.dim(`${getProgressIcon('PARALLEL')}  Parallel: ${job.node.parallelGroupIndex + 1}/${job.node.parallelGroupTotal}`)}`);
          }
          
          // Retry info
          if (job.node.retried) {
            lines.push(`    ${SEMANTIC_COLORS.warning(`${getProgressIcon('RETRY')} Retried`)}`);
          }
        }
      }
      lines.push('');
    }
    
    return lines.join('\n').trim();
  }
  
  private formatFailedJobsSummaryWithHints(failedJobs: any[], options?: BuildDetailFormatterOptions): { summary: string; hints: string[] } {
    const hints: string[] = [];
    const summary = this.formatFailedJobsSummary(failedJobs, options, hints);
    return { summary, hints };
  }
  
  private formatFailedJobsSummary(failedJobs: any[], options?: BuildDetailFormatterOptions, hints?: string[]): string {
    const lines: string[] = [];
    
    // Group identical jobs by label
    const jobGroups = this.groupJobsByLabel(failedJobs);
    
    // Show all groups if --all-jobs, otherwise limit to 10
    const displayGroups = options?.allJobs 
      ? jobGroups 
      : jobGroups.slice(0, 10);
    
    for (const group of displayGroups) {
      const label = this.parseEmoji(group.label);
      if (group.count === 1) {
        const duration = this.formatJobDuration(group.jobs[0].node);
        lines.push(`   ${SEMANTIC_COLORS.error('Failed')}: ${label} - ran ${duration}`);
      } else {
        // Multiple jobs with same label - show detailed breakdown
        const statusParts = [];
        
        if (group.stateCounts.failed > 0) {
          statusParts.push(`${group.stateCounts.failed} failed`);
        }
        if (group.stateCounts.broken > 0) {
          statusParts.push(`${group.stateCounts.broken} broken`);
        }
        if (group.stateCounts.notStarted > 0) {
          statusParts.push(`${group.stateCounts.notStarted} not started`);
        }
        if (group.stateCounts.passed > 0) {
          statusParts.push(`${group.stateCounts.passed} passed`);
        }
        if (group.stateCounts.other > 0) {
          statusParts.push(`${group.stateCounts.other} other`);
        }
        
        const statusInfo = statusParts.join(', ') || 'various states';
        
        // Show parallel info if it's a parallel job group
        const parallelInfo = group.parallelTotal > 0 ? ` (${group.count}/${group.parallelTotal} parallel)` : ` (${SEMANTIC_COLORS.count(String(group.count))} jobs)`;
        lines.push(`   ${SEMANTIC_COLORS.error('Failed')}: ${label}${parallelInfo}: ${statusInfo}`);
      }
    }
    
    // Add summary if there are more job types and not showing all
    if (!options?.allJobs) {
      const remaining = jobGroups.length - displayGroups.length;
      if (remaining > 0) {
        lines.push(`   ${SEMANTIC_COLORS.muted(`...and ${remaining} more job types`)}`);
        
        // If hints array is provided, add hint there; otherwise format inline
        if (hints) {
          hints.push('Use --all-jobs to show all jobs');
        } else {
          lines.push('');
          const tips = formatTips(
            ['Use --all-jobs to show all jobs'],
            TipStyle.GROUPED
          );
          lines.push(tips);
        }
      }
    }
    
    return lines.join('\n');
  }
  
  private groupJobsByLabel(jobs: any[]): any[] {
    const groups = new Map<string, any>();
    
    for (const job of jobs) {
      const fullLabel = job.node.label || 'Unnamed job';
      
      // Strip parallel job index from label for grouping
      // e.g., "deposit_and_filing_schedule_calculator rspec (1/22)" -> "deposit_and_filing_schedule_calculator rspec"
      const baseLabel = fullLabel.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
      
      if (!groups.has(baseLabel)) {
        groups.set(baseLabel, {
          label: baseLabel,
          count: 0,
          jobs: [],
          parallelTotal: 0,
          stateCounts: {
            failed: 0,
            broken: 0,
            notStarted: 0,
            passed: 0,
            other: 0
          }
        });
      }
      
      const group = groups.get(baseLabel)!;
      group.count++;
      group.jobs.push(job);
      
      // Track the maximum parallel total for this job group
      if (job.node.parallelGroupTotal && job.node.parallelGroupTotal > group.parallelTotal) {
        group.parallelTotal = job.node.parallelGroupTotal;
      }
      

      
      // Count by state
      const state = job.node.state?.toUpperCase();
      
      // Use exit status as source of truth when available
      // Note: exitStatus comes as a string from Buildkite API
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        if (exitCode === 0) {
          group.stateCounts.passed++;
        } else {
          group.stateCounts.failed++;
        }
      } else if (!job.node.startedAt) {
        group.stateCounts.notStarted++;
      } else if (state === 'FINISHED' || state === 'COMPLETED') {
        // For finished jobs without exit status, check passed field
        if (job.node.passed === true) {
          group.stateCounts.passed++;
        } else if (job.node.passed === false) {
          group.stateCounts.failed++;
        } else {
          group.stateCounts.other++;
        }
      } else if (state === 'FAILED') {
        group.stateCounts.failed++;
      } else if (state === 'BROKEN') {
        group.stateCounts.broken++;
      } else if (state === 'PASSED' || job.node.passed === true) {
        group.stateCounts.passed++;
      } else {
        group.stateCounts.other++;
      }
    }
    
    // Convert to array and sort by count (most failures first)
    return Array.from(groups.values())
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
    return getStateIcon(state);
  }
  
  private getJobStateIcon(state: string): string {
    return getStateIcon(state);
  }
  
  private getAnnotationIcon(style: string): string {
    return getAnnotationIcon(style);
  }
  
  private colorizeAnnotationStyle(style: string): string {
    switch (style.toUpperCase()) {
      case 'ERROR':
        return SEMANTIC_COLORS.error(style.toLowerCase());
      case 'WARNING':
        return SEMANTIC_COLORS.warning(style.toLowerCase());
      case 'INFO':
        return SEMANTIC_COLORS.info(style.toLowerCase());
      case 'SUCCESS':
        return SEMANTIC_COLORS.success(style.toLowerCase());
      default:
        return style.toLowerCase();
    }
  }
  
  private colorizeStatusIcon(icon: string, state: string): string {
    const upperState = state.toUpperCase();
    const theme = BUILD_STATUS_THEME[upperState as keyof typeof BUILD_STATUS_THEME];
    if (!theme) {
      return SEMANTIC_COLORS.muted(icon);
    }
    return theme.color(icon);
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
      
      // If we have an exit status, use that as the source of truth
      // Note: exitStatus comes as a string from Buildkite API
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        if (exitCode === 0) {
          stats.passed++;
          stats.completed++;
        } else {
          stats.failed++;
          stats.completed++;
        }
      } else if (state === 'RUNNING') {
        stats.running++;
      } else if (state === 'BLOCKED') {
        stats.blocked++;
      } else if (state === 'SKIPPED' || state === 'CANCELED') {
        stats.skipped++;
        stats.completed++;
      } else if (state === 'SCHEDULED' || state === 'ASSIGNED') {
        stats.queued++;
      } else if (state === 'FINISHED' || state === 'COMPLETED') {
        // For finished jobs without exit status, check passed field
        if (job.node.passed === true) {
          stats.passed++;
          stats.completed++;
        } else if (job.node.passed === false) {
          stats.failed++;
          stats.completed++;
        }
      } else if (state === 'PASSED' || job.node.passed === true) {
        stats.passed++;
        stats.completed++;
      } else if (state === 'FAILED' || state === 'BROKEN' || job.node.passed === false) {
        stats.failed++;
        stats.completed++;
      }
    }
    
    return stats;
  }
  
  private getFailedJobs(jobs: any[]): any[] {
    if (!jobs) return [];
    
    return jobs.filter(job => {
      const state = job.node.state?.toUpperCase();
      
      // If we have an exit status, use that as the source of truth
      // Note: exitStatus comes as a string from Buildkite API
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        return exitCode !== 0;
      }
      
      // Otherwise fall back to state
      return state === 'FAILED' || state === 'BROKEN' || job.node.passed === false;
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
      
      // If we have an exit status, use that as the source of truth
      // Note: exitStatus comes as a string from Buildkite API
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        if (exitCode === 0) {
          grouped['Passed'].push(job);
        } else {
          grouped['Failed'].push(job);
        }
      } else if (state === 'RUNNING') {
        grouped['Running'].push(job);
      } else if (state === 'BLOCKED') {
        grouped['Blocked'].push(job);
      } else if (state === 'SKIPPED' || state === 'CANCELED') {
        grouped['Skipped'].push(job);
      } else if (state === 'FINISHED' || state === 'COMPLETED') {
        // For finished jobs without exit status, check passed field
        if (job.node.passed === true) {
          grouped['Passed'].push(job);
        } else if (job.node.passed === false) {
          grouped['Failed'].push(job);
        }
      } else if (state === 'PASSED' || job.node.passed === true) {
        grouped['Passed'].push(job);
      } else if (state === 'FAILED' || state === 'BROKEN' || job.node.passed === false) {
        grouped['Failed'].push(job);
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
