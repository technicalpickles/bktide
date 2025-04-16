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
  .action(async (options) => {
    try {
      const token = getToken(options);
      const client = new BuildkiteClient(token);
      const data = await client.query(GET_VIEWER);
      
      console.log('Logged in as:');
      console.log(`- ID: ${data.viewer.id}`);
      console.log(`- Email: ${data.viewer.email}`);
    } catch (error) {
      console.error('Error fetching user information:', error);
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