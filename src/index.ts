#!/usr/bin/env node

import { Command } from 'commander';
import { BuildkiteClient } from './services/BuildkiteClient.js';
import { GET_ORGANIZATIONS, GET_PIPELINES, GET_VIEWER } from './graphql/queries.js';

const program = new Command();

// Helper to get token from env or command line
const getToken = (options: { token?: string }) => {
  if (options.token) {
    return options.token;
  }
  
  const envToken = process.env.BK_TOKEN;
  if (!envToken) {
    throw new Error('No token provided. Please set BK_TOKEN environment variable or use --token option');
  }
  
  return envToken;
};

program
  .name('bk-cli')
  .description('Buildkite CLI tool')
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello')
  .action(() => {
    console.log('Hello from bk-cli!');
  });

// Example of a command with options
program
  .command('build')
  .description('Trigger a new build')
  .option('-p, --pipeline <pipeline>', 'Pipeline slug')
  .option('-b, --branch <branch>', 'Branch name', 'main')
  .option('-c, --commit <commit>', 'Commit SHA')
  .option('-m, --message <message>', 'Build message')
  .action((options) => {
    console.log('Triggering build with options:', options);
    // Implementation would go here
  });

// New GraphQL commands
program
  .command('viewer')
  .description('Show logged in user information')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .option('-d, --debug', 'Show debug information for errors')
  .action(async (options) => {
    try {
      const token = getToken(options);
      const client = new BuildkiteClient(token);
      const data = await client.query(GET_VIEWER);
      
      // Check if we have the expected data structure
      if (!data?.viewer) {
        throw new Error('Invalid response format: missing viewer data');
      }
      
      console.log('Logged in as:');
      console.log(`- ID: ${data.viewer.id}`);
      
      // Safely display user data if available
      if (data.viewer.user) {
        console.log(`- User ID: ${data.viewer.user.id || 'N/A'}`);
        console.log(`- Name: ${data.viewer.user.name || 'N/A'}`);
        console.log(`- Email: ${data.viewer.user.email || 'N/A'}`);
      }
    } catch (error: any) {
      console.error('\n❌ Error fetching user information:');
      
      if (error.response?.errors) {
        // Handle GraphQL specific errors
        console.error('GraphQL Errors:');
        error.response.errors.forEach((err: any, i: number) => {
          console.error(`  ${i+1}. ${err.message}`);
          if (err.path) console.error(`     Path: ${err.path.join('.')}`);
        });
      } else if (error.request) {
        // Handle network errors
        console.error(`Network Error: ${error.message}`);
      } else {
        // Handle other errors
        console.error(`Error: ${error.message || 'Unknown error'}`);
      }
      
      // Show additional debug info if requested
      if (options.debug) {
        console.error('\nDebug Information:');
        console.error('Query:', GET_VIEWER);
        if (error.stack) console.error('\nStack Trace:', error.stack);
      } else {
        console.error('\nTip: Use --debug flag for more information');
      }
      
      process.exit(1);
    }
  });

program
  .command('orgs')
  .description('List organizations')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .action(async (options) => {
    try {
      const token = getToken(options);
      const client = new BuildkiteClient(token);
      const data = await client.query(GET_ORGANIZATIONS);
      
      console.log('Your organizations:');
      data.organizations.edges.forEach((edge: any) => {
        console.log(`- ${edge.node.name} (${edge.node.slug})`);
      });
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  });

program
  .command('pipelines')
  .description('List pipelines for an organization')
  .option('-t, --token <token>', 'Buildkite API token (or set BK_TOKEN env var)')
  .requiredOption('-o, --org <org>', 'Organization slug')
  .option('-n, --count <count>', 'Number of pipelines to fetch', '10')
  .action(async (options) => {
    try {
      const token = getToken(options);
      const client = new BuildkiteClient(token);
      const variables = {
        organizationSlug: options.org,
        first: parseInt(options.count, 10)
      };
      
      const data = await client.query(GET_PIPELINES, variables);
      
      console.log(`Pipelines for ${options.org}:`);
      data.organization.pipelines.edges.forEach((edge: any) => {
        console.log(`- ${edge.node.name} (${edge.node.slug})`);
      });
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    }
  });

program.parse(); 