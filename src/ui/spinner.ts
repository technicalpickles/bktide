/**
 * Spinner compatibility layer
 * Uses the new unified Progress API internally
 */

import { Progress } from './progress.js';

export interface Spinner {
  start(text: string): void;
  setText(text: string): void;
  stop(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
}

/**
 * Create a spinner using the new Progress API
 * This maintains backward compatibility while using the unified implementation
 */
export function createSpinner(format?: string): Spinner {
  const progress = Progress.spinner(undefined, { format });
  
  return {
    start: (text: string) => progress.update(text, text),
    setText: (text: string) => progress.update(text, text),
    stop: () => progress.stop(),
    succeed: (text?: string) => progress.complete(text),
    fail: (text?: string) => progress.fail(text)
  };
}


