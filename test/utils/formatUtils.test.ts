import { describe, it, expect } from 'vitest';
import {
  formatStatus,
  formatRelativeDate,
  formatDuration,
  formatBuildDuration,
  formatSize,
  truncate,
} from '../../src/utils/formatUtils.js';

describe('formatUtils', () => {
  describe('formatStatus', () => {
    it('should format PASSED state with checkmark', () => {
      const result = formatStatus('PASSED');
      expect(result).toContain('passed');
      expect(result).toContain('✓');
    });

    it('should format FAILED state with X', () => {
      const result = formatStatus('FAILED');
      expect(result).toContain('failed');
      expect(result).toContain('✖');
    });

    it('should format RUNNING state', () => {
      const result = formatStatus('RUNNING');
      expect(result).toContain('running');
      expect(result).toContain('↻');
    });

    it('should format BLOCKED state', () => {
      const result = formatStatus('BLOCKED');
      expect(result).toContain('blocked');
      expect(result).toContain('⚠');
    });

    it('should format CANCELED state', () => {
      const result = formatStatus('CANCELED');
      expect(result).toContain('canceled');
      expect(result).toContain('−');
    });

    it('should format CANCELLED state (British spelling)', () => {
      const result = formatStatus('CANCELLED');
      expect(result).toContain('canceled');
      expect(result).toContain('−');
    });

    it('should format SKIPPED state', () => {
      const result = formatStatus('SKIPPED');
      expect(result).toContain('skipped');
      expect(result).toContain('−');
    });

    it('should handle lowercase input', () => {
      const result = formatStatus('passed');
      expect(result).toContain('passed');
      expect(result).toContain('✓');
    });

    it('should handle null gracefully', () => {
      expect(formatStatus(null as any)).toContain('unknown');
    });

    it('should handle undefined gracefully', () => {
      expect(formatStatus(undefined as any)).toContain('unknown');
    });

    it('should handle empty string gracefully', () => {
      expect(formatStatus('')).toContain('unknown');
    });

    it('should format unknown state as lowercase with dash', () => {
      const result = formatStatus('SCHEDULED');
      expect(result).toContain('scheduled');
      expect(result).toContain('−');
    });
  });

  describe('formatRelativeDate', () => {
    it('should format recent date as "just now"', () => {
      const result = formatRelativeDate(new Date().toISOString());
      expect(result).toBe('just now');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('3h ago');
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('2d ago');
    });

    it('should format 1 minute ago', () => {
      const date = new Date(Date.now() - 1 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('1m ago');
    });

    it('should format 1 hour ago', () => {
      const date = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('1h ago');
    });

    it('should format 1 day ago', () => {
      const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('1d ago');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      const result = formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:00:45Z');
      expect(result).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      const result = formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:05:30Z');
      expect(result).toBe('5m 30s');
    });

    it('should handle zero duration', () => {
      const time = '2024-01-01T10:00:00Z';
      const result = formatDuration(time, time);
      expect(result).toBe('0s');
    });

    it('should format exactly 1 minute', () => {
      const result = formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:01:00Z');
      expect(result).toBe('1m 0s');
    });

    it('should format many minutes with seconds', () => {
      const result = formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:25:15Z');
      expect(result).toBe('25m 15s');
    });
  });

  describe('formatSize', () => {
    it('should format bytes', () => {
      expect(formatSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatSize(5000)).toBe('4.9 KB');
    });

    it('should format megabytes', () => {
      expect(formatSize(5000000)).toBe('4.8 MB');
    });

    it('should handle zero', () => {
      expect(formatSize(0)).toBe('0 B');
    });

    it('should handle exactly 1 KB', () => {
      expect(formatSize(1024)).toBe('1.0 KB');
    });

    it('should handle exactly 1 MB', () => {
      expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should stay in bytes below 1 KB', () => {
      expect(formatSize(1023)).toBe('1023 B');
    });
  });

  describe('truncate', () => {
    it('should return unchanged if shorter than limit', () => {
      expect(truncate('short', 50)).toBe('short');
    });

    it('should truncate and add ellipsis', () => {
      const long = 'This is a very long string';
      const result = truncate(long, 15);
      expect(result).toBe('This is a ve...');
      expect(result.length).toBe(15);
    });

    it('should replace newlines with spaces', () => {
      const result = truncate('line1\nline2\nline3', 100);
      expect(result).toBe('line1 line2 line3');
    });

    it('should handle empty strings', () => {
      expect(truncate('', 50)).toBe('');
    });

    it('should handle string with only newlines', () => {
      expect(truncate('\n\n\n', 50)).toBe('');
    });

    it('should handle string at exact limit length', () => {
      const exactString = 'exactly20charlong!!';
      expect(exactString.length).toBe(19);
      expect(truncate(exactString, 19)).toBe(exactString);
    });
  });

  describe('formatBuildDuration', () => {
    it('formats duration from startedAt and finishedAt', () => {
      const result = formatBuildDuration({
        startedAt: '2025-01-27T10:00:00Z',
        finishedAt: '2025-01-27T10:02:30Z',
      });
      expect(result).toBe('2m 30s');
    });

    it('returns empty string when not started', () => {
      const result = formatBuildDuration({
        startedAt: null,
        finishedAt: null,
      });
      expect(result).toBe('');
    });

    it('formats hours for long durations', () => {
      const result = formatBuildDuration({
        startedAt: '2025-01-27T10:00:00Z',
        finishedAt: '2025-01-27T11:30:45Z',
      });
      expect(result).toBe('1h 30m');
    });

    it('formats seconds only for short durations', () => {
      const result = formatBuildDuration({
        startedAt: '2025-01-27T10:00:00Z',
        finishedAt: '2025-01-27T10:00:45Z',
      });
      expect(result).toBe('45s');
    });
  });
});
