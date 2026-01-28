/**
 * Shared formatting utilities for formatters
 *
 * These utilities provide consistent formatting for status, dates, durations,
 * sizes, and text truncation across all formatters.
 */
import os from 'os';
import { SEMANTIC_COLORS } from '../ui/theme.js';
import { getStepDirName } from './stepUtils.js';

/**
 * Format a build/job status with icon and color
 */
export function formatStatus(state: string | null | undefined): string {
  if (!state) return SEMANTIC_COLORS.dim('unknown');
  
  const stateUpper = state.toUpperCase();
  
  switch (stateUpper) {
    case 'PASSED':
      return SEMANTIC_COLORS.success('✓ passed');
    case 'FAILED':
      return SEMANTIC_COLORS.error('✖ failed');
    case 'RUNNING':
      return SEMANTIC_COLORS.info('↻ running');
    case 'BLOCKED':
      return SEMANTIC_COLORS.warning('⚠ blocked');
    case 'CANCELED':
    case 'CANCELLED':
      return SEMANTIC_COLORS.dim('− canceled');
    case 'SKIPPED':
      return SEMANTIC_COLORS.dim('− skipped');
    default:
      return SEMANTIC_COLORS.dim(`− ${state.toLowerCase()}`);
  }
}

/**
 * Format a date as a relative time string
 * Examples: "just now", "5m ago", "3h ago", "2d ago"
 */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format duration between two dates
 * Examples: "45s", "5m 30s"
 */
export function formatDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = end.getTime() - start.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format byte size as human-readable string
 * Examples: "500 B", "4.9 KB", "4.8 MB"
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Truncate a string to a maximum length with ellipsis
 * Also replaces newlines with spaces
 */
export function truncate(str: string, length: number): string {
  // Replace newlines with spaces first
  const singleLine = str.replace(/\n+/g, ' ').trim();
  if (singleLine.length <= length) return singleLine;
  return singleLine.slice(0, length - 3) + '...';
}

/**
 * Format duration from a build or job object's timestamps
 * Returns empty string if not started
 */
export function formatBuildDuration(obj: {
  startedAt?: string | null;
  finishedAt?: string | null;
}): string {
  if (!obj.startedAt) return '';

  const start = new Date(obj.startedAt).getTime();
  const end = obj.finishedAt ? new Date(obj.finishedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Replace home directory with ~ for readable paths
 */
export function pathWithTilde(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, '~');
  }
  return fullPath;
}

/**
 * Get the directory name of the first failed step
 * Used to show example commands in navigation tips
 */
export function getFirstFailedStepDir(jobs: any[]): string | null {
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const exitCode =
      job.exitStatus !== null && job.exitStatus !== undefined
        ? parseInt(job.exitStatus, 10)
        : null;

    if (exitCode !== null && exitCode !== 0) {
      return getStepDirName(i, job.name || job.label || 'step');
    }
    if (job.state === 'FAILED' || job.passed === false) {
      return getStepDirName(i, job.name || job.label || 'step');
    }
  }
  return null;
}
