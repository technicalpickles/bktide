export type RuntimeEnvironment = 'agent' | 'interactive' | 'non-interactive';

/**
 * Provides environment-aware guidance for token setup.
 * Single source of truth for required permissions and setup instructions.
 */
export class TokenSetupGuide {
  static readonly REQUIRED_PERMISSIONS = [
    'Read Builds',
    'Read Build Logs',
    'Read Organizations',
    'GraphQL API Access',
  ];

  static readonly TOKEN_URL = 'https://buildkite.com/user/api-access-tokens/new';

  detectEnvironment(): RuntimeEnvironment {
    if (process.env.CLAUDECODE) return 'agent';
    if (process.stdout.isTTY) return 'interactive';
    return 'non-interactive';
  }

  /**
   * Guidance shown when any command fails due to missing token.
   */
  getSetupGuidance(): string {
    const env = this.detectEnvironment();

    switch (env) {
      case 'agent':
        return this.agentSetupGuidance();
      case 'interactive':
        return this.interactiveSetupGuidance();
      case 'non-interactive':
        return this.nonInteractiveSetupGuidance();
    }
  }

  /**
   * Guidance shown when `bktide token --store` is called from an agent.
   */
  getStoreGuidance(): string {
    const permissions = TokenSetupGuide.REQUIRED_PERMISSIONS.map(p => `   - ${p}`).join('\n');

    return [
      '## Token Setup Required',
      '',
      "Can't complete token setup here. The user needs to do this in their own terminal to grant keychain access and see validation feedback.",
      '',
      '### Ask the user to run in their terminal:',
      '',
      '  bktide token --store',
      '',
      'This will:',
      '1. Prompt for their Buildkite API token',
      '2. Validate it has the right permissions',
      '3. Store it securely in the system keychain',
      '',
      '### If they need to create a token first:',
      `1. Go to ${TokenSetupGuide.TOKEN_URL}`,
      '2. Required permissions:',
      permissions,
    ].join('\n');
  }

  private agentSetupGuidance(): string {
    const permissions = TokenSetupGuide.REQUIRED_PERMISSIONS.map(p => `   - ${p}`).join('\n');

    return [
      '## Setup Required: Buildkite API Token',
      '',
      'bktide needs a Buildkite API token. Ask the user to set this up in their terminal (not here, they need to see keychain prompts directly).',
      '',
      '### Steps for the user:',
      `1. Go to ${TokenSetupGuide.TOKEN_URL}`,
      '2. Create a token with these permissions:',
      permissions,
      '3. Run in their terminal: bktide token --store',
      '4. Paste the token when prompted',
    ].join('\n');
  }

  private interactiveSetupGuidance(): string {
    return [
      'No Buildkite API token found.',
      '',
      'Run this to set one up:',
      '',
      '  bktide token --store',
      '',
      'Or set the BUILDKITE_API_TOKEN environment variable.',
    ].join('\n');
  }

  private nonInteractiveSetupGuidance(): string {
    return 'No Buildkite API token. Run: bktide token --store';
  }
}
