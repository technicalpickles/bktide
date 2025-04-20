import { BaseCommand, BaseCommandOptions } from './BaseCommand.js';

export interface OrganizationOptions extends BaseCommandOptions {
}

export class ListOrganizations extends BaseCommand {
  constructor(token: string, options?: Partial<OrganizationOptions>) {
    super(token, options);
  }
  
  async execute(options: OrganizationOptions): Promise<void> {
    // Ensure initialization is complete
    await this.ensureInitialized();
    
    const data = await this.client.getOrganizations();
    
    // Debug output if debug option is enabled
    if (options.debug) {
      console.debug('API Response:', JSON.stringify(data, null, 2));
    }
    
    console.log('Your organizations:');
    
    // Safely check if data and required properties exist
    if (data?.viewer?.organizations?.edges && Array.isArray(data.viewer.organizations.edges)) {
      if (data.viewer.organizations.edges.length === 0) {
        console.log('No organizations found.');
        return;
      }
      
      data.viewer.organizations.edges.forEach((edge) => {
        if (edge?.node) {
          console.log(`- ${edge.node.name} (${edge.node.slug})`);
        }
      });
    } else {
      console.log('No organizations data returned from API.');
      if (options.debug) {
        console.debug('Received data structure:', Object.keys(data || {}).join(', '));
      }
    }
  }
} 