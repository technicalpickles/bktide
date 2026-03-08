import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenSetupGuide } from '../../src/services/TokenSetupGuide.js';

describe('TokenSetupGuide', () => {
  const originalEnv = process.env;
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLAUDECODE;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
  });

  describe('detectEnvironment', () => {
    it('should detect agent when CLAUDECODE is set', () => {
      process.env.CLAUDECODE = '1';
      const guide = new TokenSetupGuide();
      expect(guide.detectEnvironment()).toBe('agent');
    });

    it('should detect interactive when stdout is TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      const guide = new TokenSetupGuide();
      expect(guide.detectEnvironment()).toBe('interactive');
    });

    it('should detect non-interactive when stdout is not TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const guide = new TokenSetupGuide();
      expect(guide.detectEnvironment()).toBe('non-interactive');
    });

    it('should prefer agent over interactive', () => {
      process.env.CLAUDECODE = '1';
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      const guide = new TokenSetupGuide();
      expect(guide.detectEnvironment()).toBe('agent');
    });
  });

  describe('getSetupGuidance', () => {
    it('should include permissions in agent output', () => {
      process.env.CLAUDECODE = '1';
      const guide = new TokenSetupGuide();
      const output = guide.getSetupGuidance();
      expect(output).toContain('Read Builds');
      expect(output).toContain('GraphQL API Access');
      expect(output).toContain('bktide token --store');
      expect(output).toContain('their terminal');
    });

    it('should include bktide token --store in interactive output', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      const guide = new TokenSetupGuide();
      const output = guide.getSetupGuidance();
      expect(output).toContain('bktide token --store');
    });

    it('should be terse for non-interactive', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const guide = new TokenSetupGuide();
      const output = guide.getSetupGuidance();
      expect(output).toContain('bktide token --store');
      // Should be shorter than agent output
      expect(output.length).toBeLessThan(200);
    });
  });

  describe('getStoreGuidance', () => {
    it('should tell agent to direct user to their terminal', () => {
      process.env.CLAUDECODE = '1';
      const guide = new TokenSetupGuide();
      const output = guide.getStoreGuidance();
      expect(output).toContain('their terminal');
      expect(output).toContain('keychain');
      expect(output).toContain('Read Builds');
    });
  });

  describe('REQUIRED_PERMISSIONS', () => {
    it('should be a non-empty array', () => {
      expect(TokenSetupGuide.REQUIRED_PERMISSIONS.length).toBeGreaterThan(0);
    });
  });
});
