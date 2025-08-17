function isTTY(): boolean {
  return Boolean(process.stderr.isTTY);
}

function isMachineFormat(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f === 'json' || f === 'alfred';
}

function isCI(): boolean {
  // Check for common CI environment variables
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.DRONE ||
    process.env.BITBUCKET_PIPELINES_UUID ||
    process.env.AZURE_PIPELINES_BUILD_ID ||
    process.env.TF_BUILD // Azure DevOps
  );
}

function shouldDisableSpinner(format?: string): boolean {
  return !isTTY() || 
         isCI() ||
         !!process.env.NO_COLOR ||
         !!process.env.BKTIDE_NO_SPINNER ||
         isMachineFormat(format);
}

export interface Spinner {
  start(text: string): void;
  setText(text: string): void;
  stop(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
}

class TtySpinner implements Spinner {
  private timer: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private idx = 0;
  private text = '';

  start(text: string): void {
    this.text = text;
    if (this.timer) return;
    this.timer = setInterval(() => {
      const frame = this.frames[this.idx = (this.idx + 1) % this.frames.length];
      const line = `${frame} ${this.text}`;
      // Write carriage return to update the same line
      process.stderr.write(`\r${line}`);
    }, 80);
  }

  setText(text: string): void {
    this.text = text;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      // Clear line
      process.stderr.write('\r');
      process.stderr.write(' '.repeat(this.text.length + 2));
      process.stderr.write('\r');
    }
  }

  succeed(_text?: string): void {
    // Intentionally a no-op; final messaging handled by Reporter
    this.stop();
  }

  fail(_text?: string): void {
    // Intentionally a no-op; final messaging handled by Reporter
    this.stop();
  }
}

class NoopSpinner implements Spinner {
  start(_text: string): void { /* noop */ }
  setText(_text: string): void { /* noop */ }
  stop(): void { /* noop */ }
  succeed(_text?: string): void { /* noop */ }
  fail(_text?: string): void { /* noop */ }
}

export function createSpinner(format?: string): Spinner {
  if (shouldDisableSpinner(format)) {
    return new NoopSpinner();
  }
  return new TtySpinner();
}


