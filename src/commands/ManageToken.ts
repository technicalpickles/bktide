import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import prompts from 'prompts';
import { FormatterFactory, FormatterType } from '../formatters/FormatterFactory.js';
import { TokenFormatter } from '../formatters/token/Formatter.js';
import { TokenStatus, TokenValidationStatus, TokenCheckResult, TokenCheckOrStoreResult, TokenStoreResult } from '../types/credentials.js';
import { isRunningInAlfred } from '../utils/alfred.js';
import { Reporter } from '../ui/reporter.js';

export interface TokenOptions extends BaseCommandOptions {
  check?: boolean;
  store?: boolean;
  reset?: boolean;
  token?: string;
  tips?: boolean;
}

export class ManageToken extends BaseCommand {
  private formatter: TokenFormatter;
  private reporter: Reporter;

  constructor(options?: Partial<TokenOptions>) {
    super(options);
    this.formatter = FormatterFactory.getFormatter(FormatterType.TOKEN, options?.format) as TokenFormatter;
    this.reporter = new Reporter(options?.format || 'plain', options?.quiet, options?.tips);
  }

  static get requiresToken(): boolean {
    return false;
  }

  async execute(options: TokenOptions): Promise<number> {
    try {
      // Handle option priorities: if multiple options are provided, 
      // we'll process them in this priority: store > reset > check
      
      if (options.store) {
        const { success, errors } = await this.storeToken();
        if (success) {
          // Add next-steps hints after successful token storage (no redundant success message)
          this.reporter.tip('Verify access with: bktide token --check');
          this.reporter.tip('Explore your organizations: bktide orgs');
          this.reporter.tip('List pipelines: bktide pipelines');
          return 0;
        } else {
          const formattedErrors = this.formatter.formatAuthErrors('storing', errors);
          logger.console(formattedErrors);
          return 1;
        }
      } else if (options.reset) {
        await this.resetToken();
      } else if (options.check) {
        const { errors } = await this.checkToken({ format: options.format });
        if (errors.length > 0) {
          const formattedErrors = this.formatter.formatAuthErrors('validating', errors);
          logger.console(formattedErrors);
          return 0;
        }
      } else {
        const { errors } = await this.checkOrStoreToken({ format: options.format });
        if (errors.length > 0) {
          const formattedErrors = this.formatter.formatAuthErrors('checking or storing', errors);
          logger.console(formattedErrors);
          return 0;
        }
      }
      
      return 0; // Success
    } catch (error) {
      const formattedError = this.formatter.formatError('executing', error);
      logger.console(formattedError);
      return 1; // Error
    }
  }

  private async storeToken(): Promise<TokenStoreResult> {
    try {
      let tokenToStore: string | undefined;

      // If token is provided in options, use it
      if (this.options.token) {
        tokenToStore = this.options.token;
      } else {
        if (isRunningInAlfred()) {
          return { success: false, errors: [new Error('In Alfred, set token via Workflow Configuration.')] };
        }
        // Otherwise prompt the user
        const response = await prompts({
          type: 'password',
          name: 'token',
          message: 'Enter your Buildkite API token:',
          validate: value => value.length > 0 ? true : 'Please enter a valid token'
        });
        
        // Check if user cancelled the prompt (Ctrl+C)
        if (!response.token) {
          return { success: false, errors: [new Error('Token storage cancelled')] };
        }
        
        tokenToStore = response.token;
      }

      // Ensure we have a valid token before proceeding
      if (!tokenToStore) {
        return { success: false, errors: [new Error('No token provided')] };
      }
      
      // Validate the token using the CredentialManager
      const validationResult = await BaseCommand.credentialManager.validateToken(tokenToStore, {
        showProgress: true  // Show progress when validating during store
      });
      
      if (!validationResult.canListOrganizations) {
        throw new Error('Token is invalid or does not have access to list organizations');
      }

      if (!validationResult.valid) {
        const invalidOrgs = Object.entries(validationResult.organizations)
          .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations)
          .map(([org, status]) => {
            const invalidApis = [];
            if (!status.graphql) invalidApis.push('GraphQL');
            if (!status.builds) invalidApis.push('Builds');
            if (!status.organizations) invalidApis.push('Organizations');
            return `${org} (${invalidApis.join(', ')})`;
          });
        throw new Error(`Token has limited access in some organizations: ${invalidOrgs.join(', ')}`);
      }
      
      // Store the token if it's valid
      const success = await BaseCommand.credentialManager.saveToken(tokenToStore);
      
      return { success, errors: [] };
    } catch (error) {
      return { success: false, errors: [error] };
    }
  }

  private async resetToken(): Promise<void> {
    try {
      const hadToken = await BaseCommand.credentialManager.hasToken();
      let success = false;
      
      if (hadToken) {
        success = await BaseCommand.credentialManager.deleteToken();
      }
      
      const formattedResult = this.formatter.formatTokenResetResult(success, hadToken);
      logger.console(formattedResult);
    } catch (error) {
      const formattedError = this.formatter.formatError('resetting', error);
      logger.console(formattedError);
    }
  }

  private async checkOrStoreToken(options?: { format?: string }): Promise<TokenCheckOrStoreResult> {
    const { status, errors } = await this.checkToken(options);
    if (!status.hasToken || !status.isValid) {
      const { success, errors: storeErrors } = await this.storeToken();
      if (success) {
        return { stored: true, errors: [] };
      } else {
        return { stored: false, errors: storeErrors };
      }
    }
    return { stored: false, errors };
  }

  private async checkToken(options?: { format?: string }): Promise<TokenCheckResult> {
    // In Alfred, check presence of env var as token existence
    const hasToken = isRunningInAlfred()
      ? Boolean(process.env.BUILDKITE_API_TOKEN || process.env.BK_TOKEN)
      : await BaseCommand.credentialManager.hasToken();
    let isValid = false;
    let validation: TokenValidationStatus = { 
      valid: false, 
      canListOrganizations: false,
      organizations: {} 
    };
    const errors: unknown[] = [];

    if (hasToken) {
      // Get the token for validation
      const token = isRunningInAlfred()
        ? (process.env.BUILDKITE_API_TOKEN || process.env.BK_TOKEN)
        : await BaseCommand.credentialManager.getToken();
      if (!token) {
        const tokenStatus: TokenStatus = {
          hasToken: false,
          isValid: false,
          validation: { 
            valid: false, 
            canListOrganizations: false,
            organizations: {} 
          }
        };
        return { status: tokenStatus, errors };
      }

      // Validate the token using the CredentialManager
      try {
        validation = await BaseCommand.credentialManager.validateToken(token, {
          format: options?.format,
          showProgress: false  // Don't show progress since we're showing formatted output
        });
        isValid = validation.valid && validation.canListOrganizations;
      } catch (error) {
        errors.push(error);
      }
    }
    
    const tokenStatus: TokenStatus = {
      hasToken,
      isValid,
      validation
    };
    
    const formattedResult = this.formatter.formatTokenStatus(tokenStatus);
    logger.console(formattedResult);
    
    return { status: tokenStatus, errors };
  }
} 