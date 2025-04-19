import { BuildkiteClient } from '../services/BuildkiteClient.js';

export interface BaseCommandOptions {
  debug?: boolean;
  format?: string;
}

export abstract class BaseCommandHandler {
  protected token: string;
  protected client: BuildkiteClient;
  protected options: Partial<BaseCommandOptions>;
  protected initialized: boolean = false;

  constructor(token: string, options?: Partial<BaseCommandOptions>) {
    this.token = token;
    this.options = options || {};
    this.client = new BuildkiteClient(token);
    this.initialized = true; // Client is initialized in constructor
  }

  protected async ensureInitialized(): Promise<void> {
    // No additional initialization needed
    return Promise.resolve();
  }

  protected handleError(error: any, debug: boolean = false): void {
    if (debug && error instanceof Error) {
      console.error(error.stack || error.message);
    } else if (error.message) {
      console.error(error.message);
    } else {
      console.error('An unknown error occurred');
    }
  }
} 