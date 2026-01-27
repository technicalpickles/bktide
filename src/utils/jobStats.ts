// src/utils/jobStats.ts
export interface JobStats {
  total: number;
  passed: number;
  failed: number;
  softFailed: number;
  running: number;
  blocked: number;
  skipped: number;
  canceled: number;
  queued: number;
}

/**
 * Calculate job statistics from an array of jobs
 * Uses exitStatus as primary source of truth, falls back to state
 */
export function calculateJobStats(jobs: any[]): JobStats {
  const stats: JobStats = {
    total: jobs.length,
    passed: 0,
    failed: 0,
    softFailed: 0,
    running: 0,
    blocked: 0,
    skipped: 0,
    canceled: 0,
    queued: 0,
  };

  for (const job of jobs) {
    const state = job.state?.toUpperCase();

    // Check exitStatus first (most reliable)
    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      const exitCode = parseInt(job.exitStatus, 10);
      if (exitCode === 0) {
        stats.passed++;
        continue;
      } else {
        // Non-zero exit - check if soft failure
        if (job.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        continue;
      }
    }

    // Fall back to state-based classification
    switch (state) {
      case 'PASSED':
      case 'FINISHED':
        stats.passed++;
        break;
      case 'FAILED':
      case 'TIMED_OUT':
        if (job.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        break;
      case 'RUNNING':
        stats.running++;
        break;
      case 'BLOCKED':
      case 'WAITING':
        stats.blocked++;
        break;
      case 'SKIPPED':
      case 'BROKEN':
        stats.skipped++;
        break;
      case 'CANCELED':
      case 'CANCELING':
        stats.canceled++;
        break;
      case 'SCHEDULED':
      case 'ASSIGNED':
      case 'ACCEPTED':
      case 'PENDING':
        stats.queued++;
        break;
      default:
        // Unknown state - count as queued if no exit status
        stats.queued++;
    }
  }

  return stats;
}
