import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import prompts from 'prompts';
import { FormatterFactory, FormatterType } from '../formatters/FormatterFactory.js';
import { TokenFormatter } from '../formatters/token/Formatter.js';
import { TokenStatus, TokenValidationStatus } from '../types/credentials.js';

export interface TokenOptions extends BaseCommandOptions {
  check?: boolean;
  store?: boolean;
  reset?: boolean;
}

export class ManageToken extends BaseCommand {
  private formatter: TokenFormatter;

  constructor(options?: Partial<TokenOptions>) {
    super(options);
    this.formatter = FormatterFactory.getFormatter(FormatterType.TOKEN, options?.format) as TokenFormatter;
  }

  static get requiresToken(): boolean {
    return false;
  }

  async execute(options: TokenOptions): Promise<number> {
    try {
      // Handle option priorities: if multiple options are provided, 
      // we'll process them in this priority: store > reset > check
      
      if (options.store) {
        await this.storeToken();
      } else if (options.reset) {
        await this.resetToken();
      } else if (options.check) {
        await this.checkToken();
      } else {
        await this.checkOrStoreToken();
      }
      
      return 0; // Success
    } catch (error) {
      const formattedError = this.formatter.formatError('executing', error);
      logger.console(formattedError);
      return 1; // Error
    }
  }

  private async storeToken(): Promise<void> {
    try {
      const response = await prompts({
        type: 'password',
        name: 'token',
        message: 'Enter your Buildkite API token:',
        validate: value => value.length > 0 ? true : 'Please enter a valid token'
      });
      
      // Check if user cancelled the prompt (Ctrl+C)
      if (!response.token) {
        logger.info('Token storage cancelled');
        return;
      }
      
      // Validate the token before storing it
      logger.console('Validating token...');
      
      // Validate the token using the CredentialManager
      const validationResult = await BaseCommand.credentialManager.validateToken(response.token);
      
      // Check if token is valid for both APIs
      if (!validationResult.valid) {
        const validationError = this.formatter.formatTokenValidationError(validationResult);
        logger.console(validationError);
        return;
      }
      
      // Store the token if it's valid
      const success = await BaseCommand.credentialManager.saveToken(response.token);
      const formattedResult = this.formatter.formatTokenStorageResult(success);
      logger.console(formattedResult);
    } catch (error) {
      const formattedError = this.formatter.formatError('storing', error);
      logger.console(formattedError);
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

  private async checkOrStoreToken(): Promise<void> {
    const hasToken = await this.checkToken();
    if (!hasToken) {
      await this.storeToken();
    }
  }

  private async checkToken(): Promise<boolean> {
    const hasToken = await BaseCommand.credentialManager.hasToken();
    let isValid = false;
    let validation: TokenValidationStatus = { graphqlValid: false, buildAccessValid: false, orgAccessValid: false, valid: false };

    if (hasToken) {
      try {
        // Get the token for validation
        const token = await BaseCommand.credentialManager.getToken();
        if (!token) {
          const tokenStatus: TokenStatus = {
            hasToken: false,
            isValid: false,
            validation: { graphqlValid: false, buildAccessValid: false, orgAccessValid: false, valid: false }
          };
          const formattedResult = this.formatter.formatTokenStatus(tokenStatus);
          logger.console(formattedResult);
          return false;
        }

        // Validate the token using the CredentialManager
        validation = await BaseCommand.credentialManager.validateToken(token);
        isValid = validation.valid;
      } catch (error) {
        const formattedError = this.formatter.formatError('validating', error);
        logger.console(formattedError);
        return false;
      }
    }
    
    const tokenStatus: TokenStatus = {
      hasToken,
      isValid,
      validation
    };
    
    const formattedResult = this.formatter.formatTokenStatus(tokenStatus);
    logger.console(formattedResult);
    
    return hasToken && isValid;
  }
} 