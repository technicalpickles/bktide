/**
 * Utilities for working with build steps
 */

/**
 * Generate a sanitized directory name for a step
 */
export function getStepDirName(index: number, label: string): string {
  const num = String(index + 1).padStart(2, '0');
  const sanitized = label
    .replace(/:[^:]+:/g, '') // Remove emoji shortcodes like :hammer:
    .replace(/[^a-zA-Z0-9-]/g, '-') // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-') // Collapse multiple dashes
    .replace(/^-|-$/g, '') // Trim leading/trailing dashes
    .toLowerCase()
    .slice(0, 50); // Limit length
  return `${num}-${sanitized || 'step'}`;
}
