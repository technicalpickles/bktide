import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import prompts from 'prompts';
import { BuildkiteClient } from '../services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';

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
      await this.checkOrStoreToken();
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
      
      // Create clients for testing
      const graphqlClient = new BuildkiteClient(response.token, { debug: false });
      const restClient = new BuildkiteRestClient(response.token, { debug: false });
      
      // Test GraphQL API
      let graphqlValid = false;
      try {
        await graphqlClient.getViewer();
        graphqlValid = true;
      } catch (error) {
        logger.console('GraphQL API validation failed');
      }
      
      // Test REST API
      let restValid = false;
      try {
        await restClient.hasOrganizationAccess('buildkite');
        restValid = true;
      } catch (error) {
        logger.console('REST API validation failed');
      }
      
      // Check if token is valid for both APIs
      if (!graphqlValid || !restValid) {
        if (!graphqlValid && !restValid) {
          logger.error('Token is invalid for both GraphQL and REST APIs');
        } else if (!graphqlValid) {
          logger.error('Token is valid for REST API but not for GraphQL API');
        } else {
          logger.error('Token is valid for GraphQL API but not for REST API');
        }
        logger.error('Please ensure your token has the necessary permissions for both APIs');
        return;
      }
      
      // Store the token if it's valid
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

  private async checkOrStoreToken(): Promise<void> {
    if (await this.checkToken()) {
      return;
    }

    await this.storeToken();
  }

  private async checkToken(): Promise<boolean> {
    const hasToken = await BaseCommand.credentialManager.hasToken();
    if (hasToken) {
      logger.console('Token found in system keychain');

      try {
        // Get the token for validation
        const token = await BaseCommand.credentialManager.getToken();
        if (!token) {
          logger.console('Token is invalid or corrupted');
          return false;
        }

        // Create clients for testing
        const graphqlClient = new BuildkiteClient(token, { debug: false });
        const restClient = new BuildkiteRestClient(token, { debug: false });
        
        // Test GraphQL API
        let graphqlValid = false;
        try {
          await graphqlClient.getViewer();
          graphqlValid = true;
        } catch (error) {
          logger.console('GraphQL API validation failed');
        }
        
        // Test REST API
        let restValid = false;
        try {
          await restClient.hasOrganizationAccess('buildkite');
          restValid = true;
        } catch (error) {
          logger.console('REST API validation failed');
        }
        
        // Report results
        if (graphqlValid && restValid) {
          logger.console('Token is valid for both GraphQL and REST APIs');
          return true;
        } else if (graphqlValid) {
          logger.console('Token is valid for GraphQL API but not for REST API');
          return false;
        } else if (restValid) {
          logger.console('Token is valid for REST API but not for GraphQL API');
          return false;
        } else {
          logger.console('Token is invalid for both GraphQL and REST APIs');
          return false;
        }
      } catch (error) {
        logger.console('Error validating token');
        return false;
      }
    } else {
      logger.console('No token found in system keychain');
      return false;
    }
  }
} 