import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import prompts from 'prompts';

export interface TokenOptions extends BaseCommandOptions {
  check?: boolean;
  store?: boolean;
  reset?: boolean;
}

export class ManageToken extends BaseCommand {
  constructor(options?: Partial<TokenOptions>) {
    super(options);
  }

  static get requiresToken(): boolean {
    return false;
  }

  async execute(options: TokenOptions): Promise<void> {
    // Handle option priorities: if multiple options are provided, 
    // we'll process them in this priority: store > reset > check
    
    if (options.store) {
      await this.storeToken();
    } else if (options.reset) {
      await this.resetToken();
    } else if (options.check) {
      await this.checkToken();
    } else {
      // Default action if no specific flag is provided
      await this.storeToken();
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
      
      const success = await BaseCommand.credentialManager.saveToken(response.token);
      if (success) {
        logger.info('Token successfully stored in system keychain');
      } else {
        logger.error('Failed to store token');
      }
    } catch (error) {
      logger.error('Error storing token', error);
    }
  }

  private async resetToken(): Promise<void> {
    try {
      if (await BaseCommand.credentialManager.hasToken()) {
        const success = await BaseCommand.credentialManager.deleteToken();
        if (success) {
          logger.info('Token successfully deleted from system keychain');
        } else {
          logger.error('Failed to delete token');
        }
      } else {
        logger.info('No token found in system keychain');
      }
    } catch (error) {
      logger.error('Error resetting token', error);
    }
  }

  private async checkToken(): Promise<void> {
    try {
      const hasToken = await BaseCommand.credentialManager.hasToken();
      if (hasToken) {
        logger.console('Token found in system keychain');
      } else {
        logger.console('No token found in system keychain');
      }
    } catch (error) {
      logger.error('Error checking token', error);
    }
  }
} 