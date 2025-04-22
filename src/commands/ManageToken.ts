import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';
import { logger } from '../services/logger.js';
import prompts from 'prompts';
import { BuildkiteClient } from '../services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../services/BuildkiteRestClient.js';
import { FormatterFactory, FormatterType } from '../formatters/FormatterFactory.js';
import { TokenFormatter } from '../formatters/token/Formatter.js';

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
      this.handleError(error, options.debug);
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
      const formattedResult = this.formatter.formatTokenStorageResult(success);
      logger.console(formattedResult);
    } catch (error) {
      logger.error('Error storing token', error);
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
      logger.error('Error resetting token', error);
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
    let graphqlValid = false;
    let restValid = false;

    if (hasToken) {
      try {
        // Get the token for validation
        const token = await BaseCommand.credentialManager.getToken();
        if (!token) {
          const formattedResult = this.formatter.formatTokenStatus(false, false, false, false);
          logger.console(formattedResult);
          return false;
        }

        // Create clients for testing
        const graphqlClient = new BuildkiteClient(token, { debug: false });
        const restClient = new BuildkiteRestClient(token, { debug: false });
        
        // Test GraphQL API
        try {
          await graphqlClient.getViewer();
          graphqlValid = true;
        } catch (error) {
          logger.console('GraphQL API validation failed');
        }
        
        // Test REST API
        try {
          await restClient.hasOrganizationAccess('buildkite');
          restValid = true;
        } catch (error) {
          logger.console('REST API validation failed');
        }
        
        // Determine overall validity
        isValid = graphqlValid && restValid;
      } catch (error) {
        logger.console('Error validating token');
        return false;
      }
    }
    
    const formattedResult = this.formatter.formatTokenStatus(hasToken, isValid, graphqlValid, restValid);
    logger.console(formattedResult);
    
    return hasToken && isValid;
  }
} 