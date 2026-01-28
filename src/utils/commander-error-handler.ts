/**
 * Enhanced error messages for Commander.js argument errors
 */

interface CommandExample {
  usage: string;
  example: string;
}

const COMMAND_EXAMPLES: Record<string, CommandExample> = {
  build: {
    usage: 'bktide build <org/pipeline/number>',
    example: 'bktide build myorg/mypipeline/123',
  },
  pipeline: {
    usage: 'bktide pipeline <org/pipeline>',
    example: 'bktide pipeline myorg/mypipeline',
  },
  annotations: {
    usage: 'bktide annotations <org/pipeline/number>',
    example: 'bktide annotations myorg/mypipeline/123',
  },
  logs: {
    usage: 'bktide logs <org/pipeline/number>',
    example: 'bktide logs myorg/mypipeline/123',
  },
  snapshot: {
    usage: 'bktide snapshot <org/pipeline/number>',
    example: 'bktide snapshot myorg/mypipeline/123',
  },
};

/**
 * Enhance a Commander.js error message with actionable suggestions
 */
export function enhanceCommanderError(
  originalError: string,
  commandName: string,
  args: string[]
): string {
  // Handle "too many arguments" errors
  if (originalError.includes('too many arguments')) {
    return handleTooManyArgs(commandName, args);
  }

  // Handle "missing required argument" errors
  if (originalError.includes('missing required argument')) {
    return handleMissingArg(commandName);
  }

  // Handle "unknown option" errors
  if (originalError.includes('unknown option')) {
    return handleUnknownOption(originalError, commandName);
  }

  // Return original if no enhancement available
  return originalError;
}

function handleTooManyArgs(commandName: string, args: string[]): string {
  const arg = args[0] || '';

  // Pattern: builds gesso/zenpayroll -> --org gesso --pipeline zenpayroll
  if (commandName === 'builds' && arg.includes('/')) {
    const [org, pipeline] = arg.split('/');
    return `✖ Error

Did you mean: bktide builds --org ${org} --pipeline ${pipeline}

To fix this:
  1. Use --org and --pipeline flags instead of positional argument
  2. Run 'bktide builds --help' for all options`;
  }

  // Pattern: pipelines gesso -> --org gesso
  if (commandName === 'pipelines' && arg && !arg.includes('/')) {
    return `✖ Error

Did you mean: bktide pipelines --org ${arg}

To fix this:
  1. Use --org flag instead of positional argument
  2. Run 'bktide pipelines --help' for all options`;
  }

  // Pattern: orgs extraarg -> no args needed
  if (commandName === 'orgs' || commandName === 'viewer' || commandName === 'token') {
    return `✖ Error

The '${commandName}' command doesn't accept arguments.

To fix this:
  1. Remove the extra argument
  2. Run 'bktide ${commandName} --help' for available options`;
  }

  // Generic fallback
  return `✖ Error

Unexpected argument: ${arg}

Run 'bktide ${commandName} --help' for usage information.`;
}

function handleMissingArg(commandName: string): string {
  const example = COMMAND_EXAMPLES[commandName];

  if (example) {
    return `✖ Error

Missing required argument for '${commandName}'

Usage: ${example.usage}
Example: ${example.example}

Run 'bktide ${commandName} --help' for more information.`;
  }

  return `✖ Error

Missing required argument for '${commandName}'

Run 'bktide ${commandName} --help' for usage information.`;
}

function handleUnknownOption(originalError: string, commandName: string): string {
  // Extract the unknown option from the error
  const match = originalError.match(/unknown option '([^']+)'/);
  const option = match ? match[1] : 'unknown';

  return `✖ Error

Unknown option: ${option}

Run 'bktide ${commandName} --help' to see available options.`;
}
