import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';
import { TokenStatus, TokenValidationStatus } from '../../types/credentials.js';
import { SEMANTIC_COLORS, formatError as themeFormatError, formatTips, TipStyle } from '../../ui/theme.js';
    
/**
 * Plain text formatter for tokens
 */
export class PlainTextFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'plain';

  /**
   * Format token status information in plain text
   * 
   * @param status The token status information
   * @returns Formatted token status message
   */
  formatTokenStatus(status: TokenStatus): string {
    const lines: string[] = [];
    
    // Header with visual emphasis
    lines.push(SEMANTIC_COLORS.heading('Token Configuration'));
    lines.push('');
    
    // Token presence with semantic coloring - aligned labels
    if (status.hasToken) {
      if (status.isValid) {
        lines.push(`${SEMANTIC_COLORS.label('Status:')}  ${SEMANTIC_COLORS.success('✓ Valid token')}`);
      } else {
        lines.push(`${SEMANTIC_COLORS.label('Status:')}  ${SEMANTIC_COLORS.error('✖ Invalid token')}`);
      }
    } else {
      lines.push(`${SEMANTIC_COLORS.label('Status:')}  ${SEMANTIC_COLORS.muted('No token configured')}`);
    }
    
    if (status.hasToken) {
      if (status.validation.canListOrganizations) {
        const validOrgs = Object.entries(status.validation.organizations)
          .filter(([_, status]) => status.graphql && status.builds && status.organizations)
          .map(([org]) => org);
        
        const invalidOrgs = Object.entries(status.validation.organizations)
          .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations);
        
        // Display access info with aligned labels
        if (validOrgs.length > 0 || invalidOrgs.length > 0) {
          const totalOrgs = validOrgs.length + invalidOrgs.length;
          const accessLabel = totalOrgs === 1 ? 'Organization' : 'Organizations';
          lines.push(`${SEMANTIC_COLORS.label('Access:')}  ${SEMANTIC_COLORS.count(totalOrgs.toString())} ${accessLabel.toLowerCase()}`);
        }
        
        if (validOrgs.length > 0) {
          lines.push('');
          lines.push(SEMANTIC_COLORS.label('Valid Organizations:'));
          validOrgs.forEach(org => lines.push(`  ${SEMANTIC_COLORS.success('✓')} ${org}`));
        }

        if (invalidOrgs.length > 0) {
          lines.push('');
          lines.push(SEMANTIC_COLORS.warning('Limited Access:'));
          invalidOrgs.forEach(([org, status]) => {
            const invalidApis = [];
            if (!status.graphql) invalidApis.push('GraphQL');
            if (!status.builds) invalidApis.push('Builds');
            if (!status.organizations) invalidApis.push('Organizations');
            lines.push(`  ${SEMANTIC_COLORS.warning('⚠')} ${org} ${SEMANTIC_COLORS.dim(`(missing: ${invalidApis.join(', ')})`)} `);
          });
        }
      } else {
        lines.push(`${SEMANTIC_COLORS.label('Access:')}  ${SEMANTIC_COLORS.error('Cannot list organizations')}`);
      }
    } else {
      // Help for users without a token
      lines.push('');
      const actionTips = [
        'Run: bktide token --store',
        'Or set: BUILDKITE_API_TOKEN environment variable'
      ];
      lines.push(formatTips(actionTips, TipStyle.ACTIONS));
    }
    
    return lines.join('\n');
  }

  /**
   * Format token storage result in plain text
   * 
   * @param success Whether the token was successfully stored
   * @returns Formatted token storage result message
   */
  formatTokenStorageResult(success: boolean): string {
    if (success) {
      return `${SEMANTIC_COLORS.success('✓')} Token stored in system keychain`;
    } else {
      return `${SEMANTIC_COLORS.error('✖')} Failed to store token`;
    }
  }

  /**
   * Format token reset result in plain text
   * 
   * @param success Whether the token was successfully reset
   * @param hadToken Whether there was a token before reset
   * @returns Formatted token reset result message
   */
  formatTokenResetResult(success: boolean, hadToken: boolean): string {
    if (!hadToken) {
      return `${SEMANTIC_COLORS.muted('No token found in system keychain')}`;
    }

    if (success) {
      return `${SEMANTIC_COLORS.success('✓')} Token removed from system keychain`;
    } else {
      return `${SEMANTIC_COLORS.error('✖')} Failed to delete token`;
    }
  }

  /**
   * Format token validation error in plain text
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation error message
   */
  formatTokenValidationError(
    validation: TokenValidationStatus
  ): string {
    if (!validation.canListOrganizations) {
      return 'Token is invalid or does not have access to list organizations';
    }

    const invalidOrgs = Object.entries(validation.organizations)
      .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations)
      .map(([org, status]) => {
        const invalidApis = [];
        if (!status.graphql) invalidApis.push('GraphQL');
        if (!status.builds) invalidApis.push('Builds');
        if (!status.organizations) invalidApis.push('Organizations');
        return `${org} (${invalidApis.join(', ')})`;
      });

    if (invalidOrgs.length === 0) {
      return 'Token is valid for all organizations';
    }

    return `Token has limited access in some organizations: ${invalidOrgs.join(', ')}`;
  }

  /**
   * Format token validation status in plain text
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation status message
   */
  formatTokenValidationStatus(validation: TokenValidationStatus): string {
    if (!validation.canListOrganizations) {
      return 'Token is invalid or does not have access to list organizations';
    }

    const lines: string[] = [];
    const validOrgs = Object.entries(validation.organizations)
      .filter(([_, status]) => status.graphql && status.builds && status.organizations)
      .map(([org]) => org);
    
    if (validOrgs.length > 0) {
      lines.push('Valid Organizations:');
      validOrgs.forEach(org => lines.push(`  - ${org}`));
    }

    const invalidOrgs = Object.entries(validation.organizations)
      .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations);
    
    if (invalidOrgs.length > 0) {
      lines.push('Organizations with Limited Access:');
      invalidOrgs.forEach(([org, status]) => {
        const invalidApis = [];
        if (!status.graphql) invalidApis.push('GraphQL');
        if (!status.builds) invalidApis.push('Builds');
        if (!status.organizations) invalidApis.push('Organizations');
        lines.push(`  - ${org} (${invalidApis.join(', ')})`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format error message(s) in plain text
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred, or an array of errors
   * @returns Formatted error message(s)
   */
  formatError(
    operation: string,
    error: unknown | unknown[]
  ): string {
    const errors = Array.isArray(error) ? error : [error];
    const errorMessages = errors.map(err => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return errorMessage;
    });
    
    const suggestions = [];
    if (operation === 'storing' || operation === 'validating') {
      suggestions.push('Check your Buildkite API token permissions');
      suggestions.push('Get a new token at: https://buildkite.com/user/api-access-tokens');
    }
    
    const errorText = `Error ${operation} token: ${errorMessages.join(', ')}`;
    return themeFormatError(errorText, { suggestions });
  }

  /**
   * Format authentication error message(s) in plain text
   * 
   * @param operation The authentication operation that failed (e.g., 'storing', 'validating')
   * @param error The authentication error that occurred, or an array of errors
   * @returns Formatted authentication error message(s)
   */
  formatAuthErrors(
    operation: string,
    error: unknown | unknown[]
  ): string {
    const errors = Array.isArray(error) ? error : [error];
    return errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Authentication error ${operation} token: ${errorMessage}\nPlease check your token permissions and try again`;
    }).join('\n\n');
  }

  /**
   * Format multiple error messages in plain text
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param errors Array of errors that occurred
   * @returns Formatted error messages
   */
  formatErrors(
    operation: string,
    errors: unknown[]
  ): string {
    return errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error ${operation} token: ${errorMessage}`;
    }).join('\n');
  }
} 