import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';

export class Prime extends BaseCommand {
  static requiresToken = false;

  async execute(_options: BaseCommandOptions): Promise<number> {
    process.stdout.write(this.getPrimeContent());
    return 0;
  }

  private getPrimeContent(): string {
    return `<bktide-rules>
# Buildkite CI Integration

Use \`bktide\` CLI to investigate Buildkite CI failures.

## URL Patterns
- Build: \`https://buildkite.com/{org}/{pipeline}/builds/{number}\`
- Job: \`https://buildkite.com/{org}/{pipeline}/builds/{number}#{job-id}\`

## Investigate a Failing Build
\`\`\`bash
bktide snapshot <url-or-slug>
\`\`\`
Fetches build data locally. Shows summary with failed steps, then use \`bktide logs <url> <step-id>\` for specific logs.

### Snapshot Flags
- **Default** (no flags): Captures only failed/broken steps. Use this for investigating failures - you only need logs from steps that failed.
- **\`--all\`**: Captures all steps including passing ones. Use when verifying output of passing steps, debugging non-failure issues, or auditing what ran.

## From a GitHub PR
\`\`\`bash
# Find failing Buildkite checks
gh pr checks --json name,bucket,link | jq '.[] | select(.bucket == "fail")'

# Snapshot each failing build
bktide snapshot <link-from-above>
\`\`\`

## Reference Formats
Both URL and slug formats work:
- \`bktide snapshot https://buildkite.com/myorg/mypipe/builds/123\`
- \`bktide snapshot myorg/mypipe/123\`
</bktide-rules>
`;
  }
}
