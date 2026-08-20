/**
 * Utilities for naming and locating snapshot step directories on disk.
 */
import { isFailedJob } from './jobStats.js';

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

/**
 * Get directory name of first failed step, for a concrete example in tips
 */
export function getFirstFailedStepDir(scriptJobs: any[]): string | null {
  for (let i = 0; i < scriptJobs.length; i++) {
    const job = scriptJobs[i];
    if (isFailedJob(job)) {
      return getStepDirName(i, job.name || job.label || 'step');
    }
  }
  return null;
}
