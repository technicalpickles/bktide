#!/usr/bin/env node

/**
 * Extract statistical patterns from real Buildkite data
 * This script analyzes real data to extract patterns without storing sensitive information
 * 
 * Usage:
 *   npm run test:extract-patterns
 *   
 * Environment variables:
 *   BUILDKITE_API_TOKEN - Required for API access
 *   PATTERN_SAMPLE_SIZE - Number of items to sample (default: 100 for builds, 50 for pipelines)
 */

import { BuildkiteClient } from '../services/BuildkiteClient.js';
import { DataProfiler } from '../test-helpers/DataProfiler.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function extractPatterns() {
  const token = process.env.BUILDKITE_API_TOKEN;
  if (!token) {
    console.error('❌ BUILDKITE_API_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('🔍 Extracting data patterns from Buildkite...');
  
  try {
    const client = new BuildkiteClient(token, { 
      caching: false, // Don't cache during extraction
      debug: false 
    });
    
    const profiler = new DataProfiler();
    
    // Sample sizes (can be overridden with env vars)
    const buildSampleSize = parseInt(process.env.PATTERN_SAMPLE_SIZE || '100', 10);
    const pipelineSampleSize = parseInt(process.env.PIPELINE_SAMPLE_SIZE || '50', 10);
    
    console.log(`📊 Sampling ${buildSampleSize} builds from viewer...`);
    const buildsResponse = await client.getViewerBuilds(buildSampleSize);
    const builds = buildsResponse.viewer?.builds?.edges?.map(edge => edge?.node).filter(Boolean) || [];
    console.log(`  ✓ Collected ${builds.length} builds`);
    
    console.log('📊 Sampling organizations...');
    const organizations = await client.getOrganizations();
    console.log(`  ✓ Collected ${organizations.length} organizations`);
    
    // Get pipelines from the first organization
    let pipelines: any[] = [];
    if (organizations.length > 0) {
      console.log(`📊 Sampling ${pipelineSampleSize} pipelines from ${organizations[0].slug}...`);
      try {
        const pipelinesResponse = await client.getPipelines(organizations[0].slug, pipelineSampleSize);
        pipelines = pipelinesResponse.organization?.pipelines?.edges?.map(edge => edge?.node).filter(Boolean) || [];
        console.log(`  ✓ Collected ${pipelines.length} pipelines`);
      } catch (error) {
        console.warn(`  ⚠️  Could not fetch pipelines: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Extract jobs from builds (Note: viewer builds don't include jobs by default)
    // For now, we'll skip job extraction or fetch from a specific build
    console.log(`📊 Job extraction skipped (not included in viewer builds query)`);
    const jobs: any[] = [];
    
    // Profile the data
    console.log('🔬 Analyzing patterns...');
    
    const patterns = {
      builds: profiler.profileBuilds(builds as any),
      pipelines: profiler.profilePipelines(pipelines as any),
      jobs: profiler.profileJobs(jobs as any),
      organizations: profiler.profileOrganizations(organizations as any),
      extracted: new Date().toISOString(),
      sampleSize: {
        builds: builds.length,
        pipelines: pipelines.length,
        jobs: jobs.length,
        organizations: organizations.length
      }
    };
    
    // Ensure output directory exists
    const outputPath = resolve(__dirname, '../../test/fixtures/data-patterns.json');
    const outputDir = dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save patterns
    await fs.writeFile(
      outputPath,
      JSON.stringify(patterns, null, 2)
    );
    
    console.log(`✅ Successfully extracted patterns to ${outputPath}`);
    
    // Print summary statistics
    console.log('\n📈 Pattern Summary:');
    console.log('  Builds:');
    if (patterns.builds.states.values.length > 0) {
      console.log(`    - States: ${patterns.builds.states.values.slice(0, 3).map(v => `${v.value} (${(v.frequency * 100).toFixed(1)}%)`).join(', ')}`);
    }
    console.log(`    - Branch formats: feature (${(patterns.builds.branches.formats.feature * 100).toFixed(1)}%), main (${(patterns.builds.branches.formats.main * 100).toFixed(1)}%)`);
    console.log(`    - Conventional commits: ${(patterns.builds.messagePatterns.conventionalCommits * 100).toFixed(1)}%`);
    console.log(`    - Build number range: ${patterns.builds.numberRange.min} - ${patterns.builds.numberRange.max}`);
    
    if (patterns.pipelines.defaultBranches.values.length > 0) {
      console.log('  Pipelines:');
      console.log(`    - Default branches: ${patterns.pipelines.defaultBranches.values.slice(0, 3).map(v => v.value).join(', ')}`);
      console.log(`    - Repository providers: ${patterns.pipelines.repositoryProviders.values.slice(0, 3).map(v => `${v.value} (${(v.frequency * 100).toFixed(1)}%)`).join(', ')}`);
    }
    
    if (patterns.jobs.exitStatusDistribution.values.length > 0) {
      console.log('  Jobs:');
      console.log(`    - Retry rates: automatic (${(patterns.jobs.retryRates.automatic * 100).toFixed(1)}%), manual (${(patterns.jobs.retryRates.manual * 100).toFixed(1)}%)`);
      console.log(`    - Exit status distribution: ${patterns.jobs.exitStatusDistribution.values.slice(0, 3).map(v => `${v.value} (${(v.frequency * 100).toFixed(1)}%)`).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error extracting patterns:', error);
    if (error instanceof Error) {
      console.error('  ', error.message);
      if (error.stack) {
        console.debug(error.stack);
      }
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  extractPatterns();
}