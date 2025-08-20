# Hybrid Mock Generation Strategy

This document outlines a hybrid approach that combines GraphQL schema-first mocking with patterns learned from real Buildkite data.

## Overview

The strategy involves three phases:
1. **Pattern Extraction**: Analyze real data to extract statistical patterns
2. **Pattern Storage**: Store patterns (not data) in a version-controlled format
3. **Mock Generation**: Use patterns to generate realistic, schema-compliant mocks

## Implementation

### 1. Pattern Extraction Tool

```typescript
// scripts/extract-data-patterns.ts
import { BuildkiteClient } from '../src/services/BuildkiteClient.js';
import { promises as fs } from 'fs';
import { DataProfiler } from '../test/helpers/DataProfiler.js';

async function extractPatterns() {
  const client = new BuildkiteClient(process.env.BUILDKITE_API_TOKEN!);
  const profiler = new DataProfiler();
  
  // Sample real data
  const builds = await client.getBuilds({ count: 100 });
  const pipelines = await client.getPipelines({ count: 50 });
  const orgs = await client.getOrganizations();
  
  // Extract patterns (not actual data)
  const patterns = {
    builds: profiler.profileBuilds(builds),
    pipelines: profiler.profilePipelines(pipelines),
    organizations: profiler.profileOrganizations(orgs),
    extracted: new Date().toISOString()
  };
  
  // Save patterns (no sensitive data)
  await fs.writeFile(
    './test/fixtures/data-patterns.json',
    JSON.stringify(patterns, null, 2)
  );
  
  console.log('✅ Extracted patterns from real data');
}

extractPatterns().catch(console.error);
```

### 2. Data Profiler

```typescript
// test/helpers/DataProfiler.ts
export class DataProfiler {
  profileBuilds(builds: Build[]): BuildPatterns {
    return {
      states: this.getDistribution(builds.map(b => b.state)),
      branches: this.analyzeBranches(builds.map(b => b.branch)),
      messagePatterns: this.analyzeMessages(builds.map(b => b.message)),
      numberRange: {
        min: Math.min(...builds.map(b => b.number)),
        max: Math.max(...builds.map(b => b.number))
      },
      duration: this.analyzeDurations(builds),
      jobCounts: this.getDistribution(builds.map(b => b.jobs?.edges?.length || 0)),
      annotationCounts: this.getDistribution(
        builds.map(b => b.annotations?.edges?.length || 0)
      )
    };
  }
  
  private getDistribution<T>(values: T[]): Distribution<T> {
    const counts = new Map<T, number>();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    
    const total = values.length;
    const distribution: Distribution<T> = {
      values: Array.from(counts.entries()).map(([value, count]) => ({
        value,
        frequency: count / total,
        count
      })).sort((a, b) => b.frequency - a.frequency)
    };
    
    return distribution;
  }
  
  private analyzeBranches(branches: string[]): BranchPatterns {
    const patterns = {
      common: this.getCommonPrefixes(branches),
      formats: {
        feature: branches.filter(b => b.startsWith('feature/')).length / branches.length,
        bugfix: branches.filter(b => b.startsWith('bugfix/')).length / branches.length,
        release: branches.filter(b => b.match(/^release\/\d+\.\d+/)).length / branches.length,
        main: branches.filter(b => ['main', 'master'].includes(b)).length / branches.length
      }
    };
    
    return patterns;
  }
  
  private analyzeMessages(messages: string[]): MessagePatterns {
    return {
      averageLength: messages.reduce((acc, m) => acc + m.length, 0) / messages.length,
      hasEmoji: messages.filter(m => /[🎉🚀✨🔧📦👷‍♂️]/.test(m)).length / messages.length,
      conventionalCommits: messages.filter(m => 
        /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(m)
      ).length / messages.length,
      commonPrefixes: this.getCommonPrefixes(messages),
      githubRefs: messages.filter(m => /#\d+/.test(m)).length / messages.length
    };
  }
  
  private analyzeDurations(builds: Build[]): DurationPatterns {
    const durations = builds
      .filter(b => b.startedAt && b.finishedAt)
      .map(b => new Date(b.finishedAt).getTime() - new Date(b.startedAt).getTime());
    
    if (durations.length === 0) return { min: 0, max: 0, median: 0, p95: 0 };
    
    durations.sort((a, b) => a - b);
    
    return {
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)]
    };
  }
}
```

### 3. Pattern-Informed Mock Generator

```typescript
// test/helpers/PatternMockGenerator.ts
import { faker } from '@faker-js/faker';
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import patterns from '../fixtures/data-patterns.json';

export class PatternMockGenerator {
  private patterns: DataPatterns;
  
  constructor(patternsPath = './test/fixtures/data-patterns.json') {
    this.patterns = require(patternsPath);
  }
  
  generateMocks() {
    return {
      Build: () => ({
        id: faker.string.uuid(),
        number: this.generateBuildNumber(),
        state: this.selectByDistribution(this.patterns.builds.states),
        branch: this.generateBranch(),
        message: this.generateCommitMessage(),
        createdAt: faker.date.recent({ days: 30 }).toISOString(),
        startedAt: faker.date.recent({ days: 30 }).toISOString(),
        finishedAt: this.generateFinishedAt(),
        jobs: () => new MockList(
          this.selectByDistribution(this.patterns.builds.jobCounts)
        ),
        annotations: () => new MockList(
          this.selectByDistribution(this.patterns.builds.annotationCounts)
        )
      }),
      
      Pipeline: () => ({
        id: faker.string.uuid(),
        slug: this.generatePipelineSlug(),
        name: this.generatePipelineName(),
        description: faker.lorem.sentence(),
        repository: this.generateRepository(),
        defaultBranch: this.selectByDistribution(
          this.patterns.pipelines.defaultBranches
        )
      }),
      
      Job: () => ({
        id: faker.string.uuid(),
        uuid: faker.string.uuid(),
        label: this.generateJobLabel(),
        state: this.selectByDistribution(this.patterns.jobs.states),
        exitStatus: this.generateExitStatus(),
        passed: faker.datatype.boolean({ probability: 0.85 }),
        retriedAutomatically: faker.datatype.boolean({ probability: 0.05 }),
        retriedManually: faker.datatype.boolean({ probability: 0.02 })
      }),
      
      Annotation: () => ({
        id: faker.string.uuid(),
        context: this.generateAnnotationContext(),
        style: this.selectByDistribution(this.patterns.annotations.styles),
        bodyHtml: this.generateAnnotationBody()
      })
    };
  }
  
  private selectByDistribution<T>(distribution: Distribution<T>): T {
    const random = Math.random();
    let cumulative = 0;
    
    for (const item of distribution.values) {
      cumulative += item.frequency;
      if (random <= cumulative) {
        return item.value;
      }
    }
    
    return distribution.values[0].value;
  }
  
  private generateBuildNumber(): number {
    const { min, max } = this.patterns.builds.numberRange;
    return faker.number.int({ min, max });
  }
  
  private generateBranch(): string {
    const formats = this.patterns.builds.branches.formats;
    const random = Math.random();
    
    if (random < formats.feature) {
      return `feature/${faker.word.verb()}-${faker.word.noun()}`;
    } else if (random < formats.feature + formats.bugfix) {
      return `bugfix/${faker.word.verb()}-${faker.word.noun()}`;
    } else if (random < formats.feature + formats.bugfix + formats.release) {
      return `release/${faker.system.semver()}`;
    } else if (random < formats.feature + formats.bugfix + formats.release + formats.main) {
      return faker.helpers.arrayElement(['main', 'master']);
    } else {
      return faker.git.branch();
    }
  }
  
  private generateCommitMessage(): string {
    const patterns = this.patterns.builds.messagePatterns;
    const useConventional = Math.random() < patterns.conventionalCommits;
    const useEmoji = Math.random() < patterns.hasEmoji;
    const useGithubRef = Math.random() < patterns.githubRefs;
    
    let message = '';
    
    if (useConventional) {
      const type = faker.helpers.arrayElement(['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']);
      const scope = Math.random() < 0.3 ? `(${faker.word.noun()})` : '';
      message = `${type}${scope}: `;
    }
    
    if (useEmoji) {
      message += faker.helpers.arrayElement(['🎉', '🚀', '✨', '🔧', '📦', '👷‍♂️']) + ' ';
    }
    
    message += faker.git.commitMessage();
    
    if (useGithubRef) {
      message += ` (#${faker.number.int({ min: 1, max: 9999 })})`;
    }
    
    return message;
  }
  
  private generateJobLabel(): string {
    const patterns = this.patterns.jobs.labelPatterns;
    const templates = patterns.common.map(p => p.value);
    
    if (templates.length > 0 && Math.random() < 0.7) {
      const template = faker.helpers.arrayElement(templates);
      return template
        .replace(':os', faker.helpers.arrayElement(['linux', 'macos', 'windows']))
        .replace(':node', faker.helpers.arrayElement(['18', '20', '22']))
        .replace(':test', faker.helpers.arrayElement(['unit', 'integration', 'e2e']));
    }
    
    return faker.hacker.phrase();
  }
  
  private generateAnnotationContext(): string {
    const contexts = this.patterns.annotations.contexts.values;
    if (contexts.length > 0 && Math.random() < 0.8) {
      return this.selectByDistribution(this.patterns.annotations.contexts);
    }
    return faker.word.noun();
  }
  
  private generateAnnotationBody(): string {
    const useMarkdown = Math.random() < 0.6;
    
    if (useMarkdown) {
      return `
<h3>${faker.lorem.sentence()}</h3>
<p>${faker.lorem.paragraph()}</p>
<ul>
  <li>${faker.lorem.sentence()}</li>
  <li>${faker.lorem.sentence()}</li>
</ul>
`;
    }
    
    return `<p>${faker.lorem.paragraph()}</p>`;
  }
}
```

### 4. Test Setup with Pattern-Based Mocks

```typescript
// test/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { PatternMockGenerator } from './helpers/PatternMockGenerator.js';
import { setupServer } from 'msw/node';
import { graphql } from 'msw';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { typeDefs } from '../src/graphql/schema.js';

// Create pattern-informed mocks
const mockGenerator = new PatternMockGenerator();
const mocks = mockGenerator.generateMocks();

// Create mocked schema
const schema = makeExecutableSchema({ typeDefs });
const mockedSchema = addMocksToSchema({ 
  schema,
  mocks,
  preserveResolvers: false 
});

// Setup MSW server with pattern-based mocks
export const server = setupServer(
  graphql.operation((req, res, ctx) => {
    return res(
      ctx.data(
        mockedSchema.execute(req.query, req.variables)
      )
    );
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());
```

### 5. Usage in Tests

```typescript
// test/commands/ListBuilds.test.ts
import { describe, it, expect } from 'vitest';
import { ListBuilds } from '../../src/commands/ListBuilds.js';
import { server } from '../setup.js';

describe('ListBuilds Command', () => {
  it('should list builds with realistic data', async () => {
    const command = new ListBuilds();
    const result = await command.execute({
      org: 'test-org',
      pipeline: 'test-pipeline',
      count: 10
    });
    
    expect(result).toBe(0);
    // The builds will have realistic patterns based on actual data
  });
  
  it('should handle specific scenarios', async () => {
    // Override with specific test data when needed
    server.use(
      graphql.query('GetBuilds', (req, res, ctx) => {
        return res(
          ctx.data({
            viewer: {
              builds: {
                edges: [
                  {
                    node: {
                      id: 'specific-test-id',
                      state: 'FAILED',
                      message: 'Test failure scenario'
                    }
                  }
                ]
              }
            }
          })
        );
      })
    );
    
    // Test specific failure handling
  });
});
```

## Benefits

1. **Realistic Data**: Mocks follow actual patterns from your Buildkite instance
2. **No Sensitive Data**: Only patterns are stored, not actual data
3. **Version Controlled**: Patterns file can be committed to repo
4. **Flexible**: Can override with specific test data when needed
5. **Maintainable**: Regenerate patterns periodically to stay current

## Maintenance

Run pattern extraction periodically:
```bash
npm run test:extract-patterns
```

This updates the patterns file with the latest data characteristics from your Buildkite instance.
