/**
 * Shared job statistics calculation
 *
 * Buildkite job state is spread across `state`, `exitStatus`, `passed`, and
 * `softFailed`, and none of them alone is authoritative for every job shape
 * (running jobs have no exit status, finished jobs from older API responses
 * only have `passed`, etc). This is the single place that reconciles those
 * fields into one set of counts, so callers don't reimplement the state
 * machine (and drift on how soft failures get counted) independently.
 */

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
  completed: number;
}

/**
 * Calculate job statistics from a flat list of job nodes (already unwrapped
 * from any GraphQL edge).
 */
export function calculateJobStats(jobs: any[]): JobStats {
  const stats: JobStats = {
    total: jobs?.length || 0,
    passed: 0,
    failed: 0,
    softFailed: 0,
    running: 0,
    blocked: 0,
    skipped: 0,
    canceled: 0,
    queued: 0,
    completed: 0,
  };

  if (!jobs) return stats;

  for (const job of jobs) {
    const state = job.state?.toUpperCase() || '';

    // If we have an exit status, use that as the source of truth
    if (job.exitStatus !== null && job.exitStatus !== undefined) {
      const exitCode = parseInt(job.exitStatus, 10);
      if (exitCode === 0) {
        stats.passed++;
        stats.completed++;
      } else {
        if (job.softFailed === true) {
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
      if (job.passed === true) {
        stats.passed++;
        stats.completed++;
      } else if (job.passed === false) {
        if (job.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        stats.completed++;
      }
    } else if (state === 'PASSED' || job.passed === true) {
      stats.passed++;
      stats.completed++;
    } else if (state === 'FAILED' || job.passed === false) {
      if (job.softFailed === true) {
        stats.softFailed++;
      } else {
        stats.failed++;
      }
      stats.completed++;
    }
  }

  return stats;
}

/**
 * Check if a job is considered failed (hard or soft).
 * Failed states: `failed`, `timed_out`, or a non-zero exit status.
 */
export function isFailedJob(job: any): boolean {
  const state = job.state?.toUpperCase();

  if (state === 'FAILED' || state === 'TIMED_OUT') {
    return true;
  }

  if (job.exitStatus !== null && job.exitStatus !== undefined) {
    const exitCode = parseInt(job.exitStatus, 10);
    return exitCode !== 0;
  }

  if (job.passed === false) {
    return true;
  }

  return false;
}
