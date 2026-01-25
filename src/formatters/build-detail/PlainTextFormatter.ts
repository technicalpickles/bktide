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
import { useAscii } from '../../ui/symbols.js';
import { termWidth } from '../../ui/width.js';

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
    lines.push(''); // Blank line after commit info
    
    // Show annotations summary if present
    if (build.annotations?.edges?.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Jobs summary
    if (build.jobs?.edges?.length > 0) {
      if (build.annotations?.edges?.length > 0) {
        lines.push(''); // Add space between annotations and steps
      }
      lines.push(this.formatJobSummary(build.jobs, build.state));
      
      if (!options?.annotations && options?.tips !== false) {
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
    
    const allHints: string[] = [];
    
    // Annotation summary (first, as it appears first in UI)
    if (build.annotations?.edges?.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Jobs summary
    if (build.jobs?.edges?.length > 0) {
      if (build.annotations?.edges?.length > 0) {
        lines.push(''); // Add space between annotations and steps
      }
      lines.push(this.formatJobSummary(build.jobs, build.state));
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
    const failedJobs = this.getFailedJobs(build.jobs?.edges);
    if (!options?.failed && failedJobs.length > 0) {
      allHints.push('Use --failed to show failure details');
    }
    if (!options?.annotations && build.annotations?.edges?.length > 0) {
      allHints.push('Use --annotations to view annotation details');
    }
    // Add hint about incomplete step data if truncated
    if (!options?.jobs && build.jobs?.pageInfo?.hasNextPage) {
      allHints.push('Use --jobs to fetch all step data (currently showing first 100 only)');
    }
    
    // Display all hints together
    if (allHints.length > 0 && options?.tips !== false) {
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
    
    // Annotations first (if any)
    if (build.annotations?.edges?.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Jobs summary with progress
    if (build.jobs?.edges?.length > 0) {
      if (build.annotations?.edges?.length > 0) {
        lines.push(''); // Add space between annotations and steps
      }
      lines.push(this.formatJobSummary(build.jobs, build.state));
    }
    
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
    
    // Annotations first (if any)
    if (build.annotations?.edges?.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Jobs summary
    if (build.jobs?.edges?.length > 0) {
      if (build.annotations?.edges?.length > 0) {
        lines.push(''); // Add space between annotations and steps
      }
      lines.push(this.formatJobSummary(build.jobs, build.state));
    }
    
    // Blocked information
    const blockedJobs = this.getBlockedJobs(build.jobs?.edges);
    if (blockedJobs.length > 0) {
      lines.push('');
      lines.push(`${getProgressIcon('BLOCKED_MESSAGE')} Blocked: "${blockedJobs[0].node.label}" (manual unblock required)`);
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
    
    // Annotations first (if any)
    if (build.annotations?.edges?.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations.edges));
    }
    
    // Jobs summary
    if (build.jobs?.edges?.length > 0) {
      if (build.annotations?.edges?.length > 0) {
        lines.push(''); // Add space between annotations and steps
      }
      lines.push(this.formatJobSummary(build.jobs, build.state));
    }
    
    // Canceled information
    if (build.createdBy) {
      lines.push('');
      const creator = build.createdBy.name || build.createdBy.email;
      lines.push(`Canceled by: ${creator}`);
    }
    
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
    
    // Steps section
    lines.push('Steps:');
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
    
    // Get first line of commit message
    const message = build.message || 'No commit message';
    const firstLineMessage = message.split('\n')[0];
    const truncatedMessage = firstLineMessage.length > 80 ? firstLineMessage.substring(0, 77) + '...' : firstLineMessage;
    
    return `${coloredIcon} ${stateFormatted} ${truncatedMessage} ${SEMANTIC_COLORS.dim(`#${build.number}`)} ${SEMANTIC_COLORS.dim(duration)}`;
  }
  
  private formatCommitInfo(build: any): string {
    const shortSha = build.commit ? build.commit.substring(0, 7) : 'unknown';
    const branch = SEMANTIC_COLORS.identifier(build.branch);
    const age = this.formatAge(build.createdAt);
    
    // Get author information
    const author = build.createdBy?.name || build.createdBy?.email || 'Unknown';
    
    // Calculate indentation to align with commit message
    // Map each state to its proper indentation (icon + space + state text + space)
    const indentMap: Record<string, number> = {
      'PASSED': 9,      // ✓ PASSED 
      'FAILED': 9,      // ✗ FAILED 
      'RUNNING': 10,    // ⟳ RUNNING 
      'BLOCKED': 10,    // ◼ BLOCKED 
      'CANCELED': 11,   // ⊘ CANCELED 
      'SCHEDULED': 12,  // ⏱ SCHEDULED 
      'SKIPPED': 10,    // ⊙ SKIPPED 
    };
    
    const indent = ' '.repeat(indentMap[build.state] || 9);
    
    return `${indent}${author} • ${branch} • ${shortSha} • ${SEMANTIC_COLORS.dim(`Created ${age}`)}`;
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
  
  private formatJobSummary(jobsData: any, buildState: string): string {
    const jobs = jobsData?.edges;
    if (!jobs || jobs.length === 0) {
      return '';
    }

    const lines: string[] = [];
    const jobStats = this.getJobStats(jobs);

    // Build summary parts based on job states
    const countParts = [];
    if (jobStats.failed > 0) countParts.push(SEMANTIC_COLORS.error(`${jobStats.failed} failed`));
    if (jobStats.softFailed > 0) countParts.push(SEMANTIC_COLORS.warning(`▲ ${jobStats.softFailed} soft failure${jobStats.softFailed > 1 ? 's' : ''}`));
    if (jobStats.passed > 0) countParts.push(SEMANTIC_COLORS.success(`${jobStats.passed} passed`));
    if (jobStats.running > 0) countParts.push(SEMANTIC_COLORS.info(`${jobStats.running} running`));
    if (jobStats.blocked > 0) countParts.push(SEMANTIC_COLORS.warning(`${jobStats.blocked} blocked`));
    if (jobStats.canceled > 0) countParts.push(SEMANTIC_COLORS.muted(`${jobStats.canceled} canceled`));

    // Use appropriate icon based on build state
    const icon = buildState === 'FAILED' ? getStateIcon('FAILED') :
                 buildState === 'RUNNING' ? getStateIcon('RUNNING') :
                 buildState === 'PASSED' ? getStateIcon('PASSED') :
                 buildState === 'BLOCKED' ? getStateIcon('BLOCKED') : '•';

    // Check if we have partial data
    const hasMorePages = jobsData?.pageInfo?.hasNextPage;
    const totalCount = jobsData?.count;

    if (hasMorePages) {
      const showing = jobs.length;
      const total = totalCount || `${showing}+`;
      lines.push(`${icon} Showing ${SEMANTIC_COLORS.count(String(showing))} of ${SEMANTIC_COLORS.count(String(total))} steps: ${countParts.join(', ')}`);
      lines.push(SEMANTIC_COLORS.warning('⚠️  Showing first 100 steps only (more available)'));
      lines.push(SEMANTIC_COLORS.dim('  → Use --jobs to fetch all step data and see accurate statistics'));
    } else {
      lines.push(`${icon} ${SEMANTIC_COLORS.count(String(jobStats.total))} step${jobStats.total > 1 ? 's' : ''}: ${countParts.join(', ')}`);
    }

    // Show failed jobs for FAILED builds
    if (buildState === 'FAILED' && jobStats.failed > 0) {
      const failedJobs = this.getFailedJobs(jobs);
      const jobGroups = this.groupJobsByLabel(failedJobs);

      const displayGroups = jobGroups.slice(0, 3);
      for (const group of displayGroups) {
        const label = this.parseEmoji(group.label);
        const icon = getStateIcon('FAILED');

        const duration = group.count === 1 && group.jobs[0]?.node
          ? ` ${SEMANTIC_COLORS.dim(`- ran ${this.formatJobDuration(group.jobs[0].node)}`)}`
          : '';

        if (group.parallelTotal > 0) {
          lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0}/${group.parallelTotal} failed)`)}`);
        } else if (group.count > 1) {
          lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0} failed)`)}`);
        } else {
          lines.push(`   ${icon} ${label}${duration}`);
        }
      }

      if (jobGroups.length > 3) {
        lines.push(`   ${SEMANTIC_COLORS.muted(`...and ${jobGroups.length - 3} more`)}`);
      }
    }

    // Show soft failed jobs for PASSED builds OR when there are soft failures
    if (jobStats.softFailed > 0) {
      const softFailedJobs = this.getSoftFailedJobs(jobs);
      const jobGroups = this.groupJobsByLabel(softFailedJobs);

      lines.push('');
      const displayGroups = jobGroups.slice(0, 5);
      for (const group of displayGroups) {
        const label = this.parseEmoji(group.label);
        const icon = getStateIcon('SOFT_FAILED');

        const duration = group.count === 1 && group.jobs[0]?.node
          ? ` - ran ${this.formatJobDuration(group.jobs[0].node)}`
          : '';

        if (group.parallelTotal > 0) {
          lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0}/${group.parallelTotal} soft failed)`)}`);
        } else if (group.count > 1) {
          lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0} soft failed)`)}`);
        } else {
          lines.push(`   ${icon} ${label}${duration}`);
        }
      }

      if (jobGroups.length > 5) {
        lines.push(`   ${SEMANTIC_COLORS.muted(`...and ${jobGroups.length - 5} more`)}`);
      }
    }

    return lines.join('\n');
  }
  
  private formatAnnotationDetails(annotations: any[]): string {
    const lines: string[] = [];
    const isAscii = useAscii();
    const terminalWidth = termWidth();
    
    // Box drawing characters
    const boxChars = isAscii ? {
      horizontal: '-',
      vertical: '|'
    } : {
      horizontal: '─',
      vertical: '│'
    };
    
    // Create a horizontal divider with padding and centering
    const createDivider = (width: number = 80) => {
      const padding = 2; // 1 space on each side
      const maxWidth = Math.min(width, terminalWidth - padding);
      const dividerLength = Math.max(20, maxWidth - padding); // Minimum 20 chars
      const divider = boxChars.horizontal.repeat(dividerLength);
      
      // Center the divider within the terminal width
      const totalPadding = terminalWidth - dividerLength;
      const leftPadding = Math.floor(totalPadding / 2);
      const spaces = ' '.repeat(Math.max(0, leftPadding));
      
      return SEMANTIC_COLORS.dim(spaces + divider);
    };
    
    // Group annotations by style
    const grouped = this.groupAnnotationsByStyle(annotations);
    const styleOrder = ['ERROR', 'WARNING', 'INFO', 'SUCCESS'];
    
    let annotationIndex = 0;
    for (const style of styleOrder) {
      if (grouped[style]) {
        for (const annotation of grouped[style]) {
          // Add divider between annotations (but not before the first one)
          if (annotationIndex > 0) {
            lines.push('');
            lines.push(createDivider());
            lines.push('');
          }
          
          const icon = this.getAnnotationIcon(style);
          const context = annotation.node.context || 'default';
          const colorFn = this.getStyleColorFunction(style);
          
          // Single line header with pipe: "│ ℹ info: test-mapping-build"
          const pipe = colorFn(boxChars.vertical);
          const header = `${pipe} ${icon} ${style.toLowerCase()}: ${context}`;
          lines.push(header);
          
          // Add blank line with pipe for visual continuity
          lines.push(pipe);
          
          // Format the body HTML with proper HTML/markdown handling
          const body = htmlToText(annotation.node.body?.html || '', {
            wordwrap: 80,
            preserveNewlines: true
          });
          
          // Add vertical pipes to the left of the body content for visual continuity
          // Use the same color as the header for the pipes
          const bodyLines = body.split('\n');
          bodyLines.forEach((line) => {
            const paddedLine = line ? ` ${line}` : '';
            lines.push(`${pipe}${paddedLine}`);
          });
          
          annotationIndex++;
        }
      }
    }
    
    // Add summary footer for multiple annotations
    if (annotations.length > 1) {
      lines.push('');
      lines.push(createDivider());
      lines.push('');
      lines.push(SEMANTIC_COLORS.dim(`${SEMANTIC_COLORS.count(annotations.length.toString())} annotations found`));
    }
    
    return lines.join('\n').trim();
  }
  
  private getStyleColorFunction(style: string): (s: string) => string {
    const styleColorMap: Record<string, (s: string) => string> = {
      'ERROR': SEMANTIC_COLORS.error,
      'WARNING': SEMANTIC_COLORS.warning,
      'INFO': SEMANTIC_COLORS.info,
      'SUCCESS': SEMANTIC_COLORS.success
    };
    return styleColorMap[style] || ((s: string) => s);
  }
  
  private formatJobDetails(jobs: any[], options?: BuildDetailFormatterOptions): string {
    if (!jobs || jobs.length === 0) {
      return 'No steps found';
    }

    const lines: string[] = [];
    const jobStats = this.getJobStats(jobs);

    // Summary line
    const parts = [];
    if (jobStats.passed > 0) parts.push(`${getStateIcon('PASSED')} ${jobStats.passed} passed`);
    if (jobStats.failed > 0) parts.push(`${getStateIcon('FAILED')} ${jobStats.failed} failed`);
    if (jobStats.softFailed > 0) parts.push(`${getStateIcon('SOFT_FAILED')} ${jobStats.softFailed} soft failed`);
    if (jobStats.running > 0) parts.push(`${getStateIcon('RUNNING')} ${jobStats.running} running`);
    if (jobStats.blocked > 0) parts.push(`${getStateIcon('BLOCKED')} ${jobStats.blocked} blocked`);

    lines.push(`Steps: ${parts.join('  ')}`);
    lines.push('');

    // Filter jobs based on options
    let filteredJobs = jobs;
    if (options?.failed) {
      // Include both hard and soft failures
      filteredJobs = [...this.getFailedJobs(jobs), ...this.getSoftFailedJobs(jobs)];
    }

    // Group jobs by state first
    const grouped = this.groupJobsByState(filteredJobs);

    // Display order: Failed, Soft Failed, Passed, Running, Blocked
    const stateOrder = ['Failed', 'Soft Failed', 'Passed', 'Running', 'Blocked'];

    for (const state of stateOrder) {
      const stateJobs = grouped[state];
      if (!stateJobs || stateJobs.length === 0) continue;

      const icon = this.getJobStateIcon(state);
      const stateColored = this.colorizeJobState(state);

      // Collapse parallel jobs with same label
      const collapsedGroups = this.collapseParallelJobs(stateJobs);

      lines.push(`${icon} ${stateColored} (${SEMANTIC_COLORS.count(String(stateJobs.length))}):`);

      for (const group of collapsedGroups) {
        if (group.isParallelGroup && group.jobs.length > 1) {
          // Collapsed parallel group display
          const label = this.parseEmoji(group.label);
          const total = group.parallelTotal || group.jobs.length;
          const passedCount = group.jobs.filter(j => this.isJobPassed(j.node)).length;
          const failedCount = group.jobs.filter(j => this.isJobFailed(j.node) || this.isJobSoftFailed(j.node)).length;

          // Show summary line for parallel group
          if (failedCount > 0) {
            const coloredLabel = this.colorizeJobLabel(state, label);
            lines.push(`  ${coloredLabel} ${SEMANTIC_COLORS.dim(`(${passedCount}/${total} passed, ${failedCount} failed)`)}`);

            // Show failed steps individually
            const failedJobs = group.jobs.filter(j => this.isJobFailed(j.node) || this.isJobSoftFailed(j.node));
            for (const job of failedJobs) {
              const duration = this.formatJobDuration(job.node);
              const parallelInfo = job.node.parallelGroupIndex !== undefined
                ? ` ${SEMANTIC_COLORS.dim(`[Parallel: ${job.node.parallelGroupIndex + 1}/${job.node.parallelGroupTotal}]`)}`
                : '';
              const failType = this.isJobSoftFailed(job.node) ? 'Soft Failed' : 'Failed';
              const failColor = this.isJobSoftFailed(job.node) ? SEMANTIC_COLORS.warning : SEMANTIC_COLORS.error;
              lines.push(`    ${failColor('↳ ' + failType)}: ${SEMANTIC_COLORS.dim(duration)}${parallelInfo}`);
            }
          } else {
            // All passed/running/blocked - just show summary
            const avgDuration = this.calculateAverageDuration(group.jobs);
            const coloredLabel = this.colorizeJobLabel(state, label);
            lines.push(`  ${coloredLabel} ${SEMANTIC_COLORS.dim(`(${total} parallel steps, avg: ${avgDuration})`)}`);
          }
        } else {
          // Single job or non-parallel group
          const job = group.jobs[0];
          const label = this.parseEmoji(job.node.label);
          const duration = this.formatJobDuration(job.node);

          const coloredLabel = this.colorizeJobLabel(state, label);

          const parallelInfo = (job.node.parallelGroupIndex !== undefined && job.node.parallelGroupTotal)
            ? ` ${SEMANTIC_COLORS.dim(`[Parallel: ${job.node.parallelGroupIndex + 1}/${job.node.parallelGroupTotal}]`)}`
            : '';

          lines.push(`  ${coloredLabel} ${SEMANTIC_COLORS.dim(`(${duration})`)}${parallelInfo}`);

          // Show additional details if --jobs or --full and single step
          if ((options?.jobs || options?.full) && !group.isParallelGroup) {
            if (job.node.retried) {
              lines.push(`    ${SEMANTIC_COLORS.warning(`${getProgressIcon('RETRY')} Retried`)}`);
            }
          }
        }
      }
      lines.push('');
    }

    return lines.join('\n').trim();
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
      case 'soft failed':
        return SEMANTIC_COLORS.warning(state);
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
    if (state === 'Soft Failed') {
      return getStateIcon('SOFT_FAILED');
    }
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
      softFailed: 0,
      running: 0,
      blocked: 0,
      skipped: 0,
      canceled: 0,
      queued: 0,
      completed: 0
    };

    if (!jobs) return stats;

    for (const job of jobs) {
      const state = job.node.state?.toUpperCase() || '';

      // If we have an exit status, use that as the source of truth
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        if (exitCode === 0) {
          stats.passed++;
          stats.completed++;
        } else {
          // Non-zero exit: check if soft failure
          if (job.node.softFailed === true) {
            stats.softFailed++;
          } else {
            stats.failed++;
          }
          stats.completed++;
        }
      } else if (state === 'RUNNING') {
        stats.running++;
      } else if (state === 'BLOCKED') {
        stats.blocked++;
      } else if (state === 'CANCELED' || state === 'CANCELLED') {
        stats.canceled++;
        stats.completed++;
      } else if (state === 'SKIPPED' || state === 'BROKEN') {
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
          // Check softFailed for finished jobs too
          if (job.node.softFailed === true) {
            stats.softFailed++;
          } else {
            stats.failed++;
          }
          stats.completed++;
        }
      } else if (state === 'PASSED' || job.node.passed === true) {
        stats.passed++;
        stats.completed++;
      } else if (state === 'FAILED' || job.node.passed === false) {
        // Check softFailed for explicitly failed jobs
        if (job.node.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        stats.completed++;
      }
    }

    return stats;
  }
  
  private getFailedJobs(jobs: any[]): any[] {
    if (!jobs) return [];

    return jobs.filter(job => {
      const state = job.node.state?.toUpperCase();

      // BROKEN jobs are skipped/not run, not failed
      if (state === 'BROKEN' || state === 'SKIPPED') {
        return false;
      }

      // If we have an exit status, use that as the source of truth
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        // Only return hard failures (not soft failures)
        return exitCode !== 0 && job.node.softFailed !== true;
      }

      // For FINISHED jobs, check the passed field
      if (state === 'FINISHED') {
        return job.node.passed === false && job.node.softFailed !== true;
      }

      // Otherwise check if explicitly failed (and not soft)
      return state === 'FAILED' && job.node.softFailed !== true;
    });
  }

  private getSoftFailedJobs(jobs: any[]): any[] {
    if (!jobs) return [];

    return jobs.filter(job => {
      const state = job.node.state?.toUpperCase();

      // BROKEN jobs are skipped/not run, not failed
      if (state === 'BROKEN' || state === 'SKIPPED') {
        return false;
      }

      // If we have an exit status, use that as the source of truth
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        return exitCode !== 0 && job.node.softFailed === true;
      }

      // For FINISHED jobs, check the passed field and softFailed
      if (state === 'FINISHED') {
        return job.node.passed === false && job.node.softFailed === true;
      }

      return false;
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
      'Soft Failed': [],
      'Passed': [],
      'Running': [],
      'Blocked': []
    };

    if (!jobs) return grouped;

    for (const job of jobs) {
      const state = job.node.state?.toUpperCase() || '';

      // If we have an exit status, use that as the source of truth
      if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
        const exitCode = parseInt(job.node.exitStatus, 10);
        if (exitCode === 0) {
          grouped['Passed'].push(job);
        } else {
          // Non-zero exit: check if soft failure
          if (job.node.softFailed === true) {
            grouped['Soft Failed'].push(job);
          } else {
            grouped['Failed'].push(job);
          }
        }
      } else if (state === 'RUNNING') {
        grouped['Running'].push(job);
      } else if (state === 'BLOCKED') {
        grouped['Blocked'].push(job);
      } else if (state === 'SKIPPED' || state === 'CANCELED' || state === 'BROKEN') {
        // Don't display skipped/broken/canceled jobs
      } else if (state === 'FINISHED' || state === 'COMPLETED') {
        // For finished jobs without exit status, check passed field
        if (job.node.passed === true) {
          grouped['Passed'].push(job);
        } else if (job.node.passed === false) {
          // Check softFailed
          if (job.node.softFailed === true) {
            grouped['Soft Failed'].push(job);
          } else {
            grouped['Failed'].push(job);
          }
        }
      } else if (state === 'PASSED' || job.node.passed === true) {
        grouped['Passed'].push(job);
      } else if (state === 'FAILED') {
        // Check softFailed for explicitly failed jobs
        if (job.node.softFailed === true) {
          grouped['Soft Failed'].push(job);
        } else {
          grouped['Failed'].push(job);
        }
      }
    }

    return grouped;
  }
  
  private collapseParallelJobs(jobs: any[]): Array<{ 
    label: string; 
    jobs: any[]; 
    isParallelGroup: boolean;
    parallelTotal?: number;
  }> {
    const groups: Map<string, any[]> = new Map();
    
    // Group jobs by label
    for (const job of jobs) {
      const label = job.node.label || 'Unnamed';
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(job);
    }
    
    // Convert to array and determine if each group is a parallel group
    const result = [];
    for (const [label, groupJobs] of groups.entries()) {
      // Check if this is a parallel group (multiple jobs with same label and parallel info)
      const hasParallelInfo = groupJobs.some(j => 
        j.node.parallelGroupIndex !== undefined && j.node.parallelGroupTotal !== undefined
      );
      
      const isParallelGroup = hasParallelInfo && groupJobs.length > 1;
      
      // Get the total from the first job if available
      const parallelTotal = groupJobs[0]?.node?.parallelGroupTotal;
      
      result.push({
        label,
        jobs: groupJobs,
        isParallelGroup,
        parallelTotal
      });
    }
    
    return result;
  }
  
  private isJobPassed(job: any): boolean {
    const state = job.state?.toUpperCase();
    
    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      return parseInt(job.exitStatus, 10) === 0;
    }
    
    if (state === 'PASSED') return true;
    if (state === 'FINISHED' || state === 'COMPLETED') {
      return job.passed === true;
    }
    
    return job.passed === true;
  }
  
  private isJobFailed(job: any): boolean {
    const state = job.state?.toUpperCase();

    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      return parseInt(job.exitStatus, 10) !== 0;
    }

    if (state === 'FAILED') return true;
    if (state === 'FINISHED' || state === 'COMPLETED') {
      return job.passed === false;
    }

    return false;
  }

  private isJobSoftFailed(job: any): boolean {
    const state = job.state?.toUpperCase();

    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      return parseInt(job.exitStatus, 10) !== 0 && job.softFailed === true;
    }

    if (state === 'FINISHED' || state === 'COMPLETED') {
      return job.passed === false && job.softFailed === true;
    }

    return false;
  }

  private colorizeJobLabel(state: string, label: string): string {
    switch (state) {
      case 'Failed':
        return SEMANTIC_COLORS.error(label);
      case 'Soft Failed':
        return SEMANTIC_COLORS.warning(label);
      case 'Passed':
        return SEMANTIC_COLORS.success(label);
      case 'Running':
        return SEMANTIC_COLORS.info(label);
      case 'Blocked':
        return SEMANTIC_COLORS.warning(label);
      default:
        return label;
    }
  }

  private calculateAverageDuration(jobs: any[]): string {
    const durationsMs = jobs
      .filter(j => j.node.startedAt && j.node.finishedAt)
      .map(j => {
        const start = new Date(j.node.startedAt).getTime();
        const end = new Date(j.node.finishedAt).getTime();
        return end - start;
      });
    
    if (durationsMs.length === 0) {
      return 'unknown';
    }
    
    const avgMs = durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length;
    const avgSeconds = Math.floor(avgMs / 1000);
    
    if (avgSeconds < 60) {
      return `${avgSeconds}s`;
    }
    
    const minutes = Math.floor(avgSeconds / 60);
    const seconds = avgSeconds % 60;
    
    if (minutes < 60) {
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
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
