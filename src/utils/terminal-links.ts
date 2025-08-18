/**
 * Terminal hyperlink support for clickable URLs
 * 
 * Uses OSC 8 escape sequences for terminals that support it.
 * Similar to color handling, provides auto-detection with override options.
 */

import chalk from 'chalk';

/**
 * Check if the terminal supports hyperlinks
 * Based on known terminal programs and environment variables
 */
function supportsHyperlinks(): boolean {
  // Check for common CI environments where hyperlinks won't work
  if (process.env.CI) {
    return false;
  }

  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || '';
  const termName = process.env.TERM?.toLowerCase() || '';
  
  // Known terminals that support OSC 8 hyperlinks
  const supportedTerminals = [
    'vscode',
    'cursor',
    'iterm.app',
    'iterm2',
    'hyper',
    'wezterm',
    'kitty',
    'ghostty',
    'tabby',
    'terminus',
    'konsole',
    'rio',
  ];
  
  // Check TERM_PROGRAM
  if (supportedTerminals.some(t => termProgram.includes(t))) {
    return true;
  }
  
  // Check TERM for some terminals
  if (termName.includes('kitty') || termName.includes('wezterm')) {
    return true;
  }
  
  // Windows Terminal sets this
  if (process.env.WT_SESSION) {
    return true;
  }
  
  // VS Code integrated terminal
  if (process.env.VSCODE_GIT_IPC_HANDLE || process.env.VSCODE_INJECTION) {
    return true;
  }
  
  return false;
}

/**
 * Check if TTY is available (similar to color detection)
 */
function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/**
 * Determine if hyperlinks should be enabled
 * Follows same pattern as color detection
 */
export function hyperlinksEnabled(): boolean {
  // Respect NO_COLOR as it indicates plain text preference
  if (process.env.NO_COLOR) return false;
  
  // Check for explicit hyperlink mode
  const mode = process.env.BKTIDE_HYPERLINK_MODE || process.env.FORCE_HYPERLINK || 'auto';
  
  if (mode === 'never' || mode === '0') return false;
  if (mode === 'always' || mode === '1') return true;
  
  // Auto mode: check if TTY and terminal supports it
  return isTTY() && supportsHyperlinks();
}

/**
 * Format a terminal hyperlink using OSC 8 escape sequence
 * 
 * @param url - The URL to link to
 * @param label - Optional label text (defaults to URL)
 * @returns Formatted string with hyperlink if supported, fallback otherwise
 */
export function terminalLink(url: string, label?: string): string {
  const text = label || url;
  
  if (!url) {
    return text;
  }
  
  // If hyperlinks are enabled, use OSC 8 escape sequence
  if (hyperlinksEnabled()) {
    // OSC 8 format: ESC]8;;URL\aLABEL\ESC]8;;\a
    // \x1b = ESC, \x07 = BEL (more compatible than ST)
    return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
  }
  
  // Fallback: use chalk underline if colors are enabled
  // This matches the existing url formatting in theme.ts
  if (process.stdout.isTTY && !process.env.NO_COLOR) {
    return chalk.underline.cyan(text);
  }
  
  // Final fallback: plain text with angle brackets if URL differs from label
  if (label && label !== url) {
    return `${label} <${url}>`;
  }
  
  return `<${url}>`;
}

/**
 * Create a hyperlink with automatic Buildkite URL construction
 * 
 * @param org - Organization slug
 * @param pipeline - Pipeline slug (optional)
 * @param buildNumber - Build number (optional)
 * @param label - Optional label text
 */
export function buildkiteLink(
  org: string,
  pipeline?: string,
  buildNumber?: number,
  label?: string
): string {
  let url = `https://buildkite.com/${org}`;
  
  if (pipeline) {
    url += `/${pipeline}`;
    if (buildNumber) {
      url += `/builds/${buildNumber}`;
    }
  }
  
  return terminalLink(url, label);
}

/**
 * Create a GitHub pull request link
 * 
 * @param repoUrl - Repository URL (GitHub format)
 * @param prNumber - Pull request number or ID
 * @param label - Optional label text
 */
export function githubPRLink(
  repoUrl: string,
  prNumber: string | number,
  label?: string
): string {
  // Extract owner/repo from various GitHub URL formats
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) {
    return label || `PR #${prNumber}`;
  }
  
  const [, owner, repo] = match;
  const url = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  
  return terminalLink(url, label || `PR #${prNumber}`);
}

/**
 * Parse and linkify URLs in text content
 * Useful for annotation content that might contain URLs
 * 
 * @param text - Text that might contain URLs
 * @returns Text with URLs converted to hyperlinks
 */
export function linkifyUrls(text: string): string {
  if (!hyperlinksEnabled()) {
    return text;
  }
  
  // Simple URL regex - matches http(s) URLs
  const urlRegex = /https?:\/\/[^\s<>"\{\}\|\\\^\[\]`]+/gi;
  
  return text.replace(urlRegex, (url) => {
    // Clean up common trailing punctuation that might not be part of the URL
    const cleanUrl = url.replace(/[.,;:!?]+$/, '');
    const trailing = url.slice(cleanUrl.length);
    
    return terminalLink(cleanUrl) + trailing;
  });
}

/**
 * Format a help URL with appropriate styling
 */
export function helpLink(url: string, label: string = 'Learn more'): string {
  return terminalLink(url, label);
}
