/**
 * PatternMockGenerator uses extracted data patterns to generate realistic mock data
 */

import { faker } from '@faker-js/faker';
import { MockList } from '@graphql-tools/mock';
import type { DataPatterns, Distribution } from './DataProfiler.js';
import { promises as fs } from 'fs';

export class PatternMockGenerator {
  private patterns: DataPatterns | null = null;
  private readonly patternsPath: string;
  private useDefaultPatterns = false;

  constructor(patternsPath = './test/fixtures/data-patterns.json') {
    this.patternsPath = patternsPath;
  }

  async loadPatterns(): Promise<void> {
    try {
      const data = await fs.readFile(this.patternsPath, 'utf-8');
      this.patterns = JSON.parse(data);
      console.log(`✓ Loaded data patterns from ${this.patternsPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not load patterns from ${this.patternsPath}, using defaults`);
      this.useDefaultPatterns = true;
    }
  }

  generateMocks() {
    if (!this.patterns && !this.useDefaultPatterns) {
      throw new Error('Patterns not loaded. Call loadPatterns() first.');
    }

    return {
      // Core types
      Build: () => ({
        id: faker.string.uuid(),
        number: this.generateBuildNumber(),
        state: this.generateBuildState(),
        branch: this.generateBranch(),
        message: this.generateCommitMessage(),
        commit: faker.git.commitSha(),
        createdAt: faker.date.recent({ days: 30 }).toISOString(),
        scheduledAt: faker.date.recent({ days: 30 }).toISOString(),
        startedAt: faker.date.recent({ days: 30 }).toISOString(),
        finishedAt: this.generateFinishedAt(),
        canceledAt: null,
        url: `https://buildkite.com/${faker.word.noun()}/${faker.word.noun()}/builds/${faker.number.int({ min: 1, max: 9999 })}`,
        webUrl: `https://buildkite.com/${faker.word.noun()}/${faker.word.noun()}/builds/${faker.number.int({ min: 1, max: 9999 })}`,
        pullRequest: this.generatePullRequest(),
        rebuiltFrom: null,
        jobs: this.generateJobs(),
        annotations: this.generateAnnotations(),
        createdBy: this.generateCreator(),
        pipeline: this.generatePipelineRef(),
        organization: this.generateOrganizationRef()
      }),

      Pipeline: () => ({
        id: faker.string.uuid(),
        graphqlId: faker.string.uuid(),
        slug: this.generatePipelineSlug(),
        name: this.generatePipelineName(),
        description: faker.datatype.boolean({ probability: 0.7 }) 
          ? faker.lorem.sentence() 
          : null,
        url: `https://buildkite.com/${faker.word.noun()}/${faker.word.noun()}`,
        webUrl: `https://buildkite.com/${faker.word.noun()}/${faker.word.noun()}`,
        repository: this.generateRepository(),
        defaultBranch: this.generateDefaultBranch(),
        visibility: this.generateVisibility(),
        archived: faker.datatype.boolean({ probability: 0.05 }),
        createdAt: faker.date.past({ years: 2 }).toISOString(),
        createdBy: this.generateCreator(),
        builds: () => new MockList([0, 10]),
        organization: this.generateOrganizationRef()
      }),

      Job: () => this.generateJob(),

      JobTypeCommand: () => ({
        ...this.generateJobBase(),
        __typename: 'JobTypeCommand',
        command: faker.helpers.arrayElement([
          'npm test',
          'yarn build',
          'make test',
          './scripts/test.sh',
          'docker build .',
          'pytest',
          'cargo test'
        ]),
        exitStatus: this.generateExitStatus(),
        passed: faker.datatype.boolean({ probability: 0.85 }),
        softFailed: faker.datatype.boolean({ probability: 0.02 }),
        parallelGroupIndex: this.generateParallelGroupIndex(),
        parallelGroupTotal: this.generateParallelGroupTotal(),
        retriedAutomatically: faker.datatype.boolean({ 
          probability: this.patterns?.jobs.retryRates.automatic || 0.05 
        }),
        retriedManually: faker.datatype.boolean({ 
          probability: this.patterns?.jobs.retryRates.manual || 0.02 
        }),
        retryType: null,
        agent: this.generateAgent(),
        agentQueryRules: [],
        artifacts: () => new MockList([0, 5])
      }),

      JobTypeWait: () => ({
        ...this.generateJobBase(),
        __typename: 'JobTypeWait',
        continueOnFailure: faker.datatype.boolean({ probability: 0.1 })
      }),

      JobTypeTrigger: () => ({
        ...this.generateJobBase(),
        __typename: 'JobTypeTrigger',
        triggered: faker.datatype.boolean({ probability: 0.9 }),
        triggeredBuild: faker.datatype.boolean({ probability: 0.9 }) 
          ? { id: faker.string.uuid() }
          : null
      }),

      Organization: () => ({
        id: faker.string.uuid(),
        graphqlId: faker.string.uuid(),
        slug: this.generateOrganizationSlug(),
        name: this.generateOrganizationName(),
        url: `https://buildkite.com/${faker.word.noun()}`,
        webUrl: `https://buildkite.com/${faker.word.noun()}`,
        pipelines: () => new MockList(
          this.selectByDistribution(
            this.patterns?.organizations.pipelineCount || { 
              values: [{ value: 10, frequency: 0.5, count: 1 }] 
            }
          )
        ),
        members: () => new MockList(
          this.selectByDistribution(
            this.patterns?.organizations.memberCount || { 
              values: [{ value: 5, frequency: 0.5, count: 1 }] 
            }
          )
        ),
        teams: () => new MockList([1, 5]),
        createdAt: faker.date.past({ years: 3 }).toISOString()
      }),

      Annotation: () => ({
        id: faker.string.uuid(),
        context: this.generateAnnotationContext(),
        style: this.generateAnnotationStyle(),
        bodyHtml: this.generateAnnotationBody(),
        createdAt: faker.date.recent({ days: 1 }).toISOString(),
        updatedAt: faker.date.recent({ days: 1 }).toISOString()
      }),

      User: () => ({
        id: faker.string.uuid(),
        uuid: faker.string.uuid(),
        name: this.generateUserName(),
        email: this.generateUserEmail(),
        avatar: {
          url: faker.image.avatar()
        },
        bot: faker.datatype.boolean({ 
          probability: this.patterns?.builds.creatorPatterns.botUsers || 0.1 
        })
      }),

      Agent: () => this.generateAgent(),

      Viewer: () => ({
        id: faker.string.uuid(),
        user: {
          id: faker.string.uuid(),
          uuid: faker.string.uuid(),
          name: faker.person.fullName(),
          email: faker.internet.email()
        },
        organizations: () => new MockList([1, 5])
      }),

      // Scalar types
      DateTime: () => faker.date.recent().toISOString(),
      ISO8601Date: () => faker.date.recent().toISOString().split('T')[0],
      JSON: () => JSON.stringify({ key: faker.word.noun(), value: faker.word.verb() }),
      YAML: () => `key: ${faker.word.noun()}\nvalue: ${faker.word.verb()}`,
      Int: () => faker.number.int({ min: 0, max: 1000 }),
      Float: () => faker.number.float({ min: 0, max: 1000, multipleOf: 0.01 }),
      Boolean: () => faker.datatype.boolean(),
      String: () => faker.lorem.word()
    };
  }

  private selectByDistribution<T>(distribution: Distribution<T>): T {
    if (!distribution.values || distribution.values.length === 0) {
      // Return a default value based on type
      return 0 as T;
    }

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
    if (this.patterns?.builds.numberRange) {
      const { min, max } = this.patterns.builds.numberRange;
      return faker.number.int({ min, max });
    }
    return faker.number.int({ min: 1, max: 9999 });
  }

  private generateBuildState(): string {
    if (this.patterns?.builds.states) {
      return this.selectByDistribution(this.patterns.builds.states);
    }
    return faker.helpers.arrayElement([
      'PASSED', 'FAILED', 'RUNNING', 'SCHEDULED', 
      'CANCELED', 'CANCELING', 'BLOCKED', 'NOT_RUN'
    ]);
  }

  private generateBranch(): string {
    if (!this.patterns?.builds.branches) {
      return faker.git.branch();
    }

    const formats = this.patterns.builds.branches.formats;
    const random = Math.random();
    
    if (random < formats.feature) {
      return `feature/${faker.word.verb()}-${faker.word.noun()}`;
    } else if (random < formats.feature + formats.bugfix) {
      return `bugfix/${faker.word.verb()}-${faker.word.noun()}`;
    } else if (random < formats.feature + formats.bugfix + formats.release) {
      return `release/${faker.system.semver()}`;
    } else if (random < formats.feature + formats.bugfix + formats.release + formats.main) {
      return faker.helpers.arrayElement(['main', 'master', 'develop']);
    } else {
      return faker.git.branch();
    }
  }

  private generateCommitMessage(): string {
    if (!this.patterns?.builds.messagePatterns) {
      return faker.git.commitMessage();
    }

    const patterns = this.patterns.builds.messagePatterns;
    const useConventional = Math.random() < patterns.conventionalCommits;
    const useEmoji = Math.random() < patterns.hasEmoji;
    const useGithubRef = Math.random() < patterns.githubRefs;
    const useJiraRef = Math.random() < patterns.jiraRefs;
    const useMultiline = Math.random() < patterns.multiline;
    
    let message = '';
    
    if (useConventional) {
      const type = faker.helpers.arrayElement([
        'feat', 'fix', 'docs', 'style', 'refactor', 
        'test', 'chore', 'perf', 'ci', 'build'
      ]);
      const scope = Math.random() < 0.3 ? `(${faker.word.noun()})` : '';
      message = `${type}${scope}: `;
    }
    
    if (useEmoji) {
      message += faker.helpers.arrayElement(['🎉', '🚀', '✨', '🔧', '📦', '👷', '🐛', '⚡️', '✅', '💚']) + ' ';
    }
    
    message += faker.git.commitMessage();
    
    if (useGithubRef) {
      message += ` (#${faker.number.int({ min: 1, max: 9999 })})`;
    }
    
    if (useJiraRef) {
      const project = faker.helpers.arrayElement(['PROJ', 'TEAM', 'BUG', 'FEAT']);
      message += ` ${project}-${faker.number.int({ min: 1, max: 9999 })}`;
    }
    
    if (useMultiline) {
      message += '\n\n' + faker.lorem.paragraph();
    }
    
    return message;
  }

  private generateFinishedAt(): string | null {
    const shouldBeFinished = Math.random() < 0.9;
    if (shouldBeFinished) {
      return faker.date.recent({ days: 30 }).toISOString();
    }
    return null;
  }

  private generatePullRequest() {
    const hasPR = Math.random() < 0.3;
    if (!hasPR) return null;
    
    return {
      id: faker.number.int({ min: 1, max: 9999 }).toString(),
      base: faker.git.branch(),
      repository: `https://github.com/${faker.word.noun()}/${faker.word.noun()}`
    };
  }

  private generateJobs() {
    const count = this.patterns?.builds.jobCounts 
      ? this.selectByDistribution(this.patterns.builds.jobCounts)
      : faker.number.int({ min: 1, max: 10 });
    
    return () => new MockList(count);
  }

  private generateAnnotations() {
    const count = this.patterns?.builds.annotationCounts 
      ? this.selectByDistribution(this.patterns.builds.annotationCounts)
      : faker.number.int({ min: 0, max: 3 });
    
    return () => new MockList(count);
  }

  private generateCreator() {
    return {
      id: faker.string.uuid(),
      name: this.generateUserName(),
      email: this.generateUserEmail(),
      avatar: {
        url: faker.image.avatar()
      }
    };
  }

  private generateUserName(): string {
    if (this.patterns?.builds.creatorPatterns.nameFormats) {
      const format = this.selectByDistribution(
        this.patterns.builds.creatorPatterns.nameFormats
      );
      
      switch (format) {
        case 'full-name':
          return faker.person.fullName();
        case 'dotted':
          return `${faker.person.firstName()}.${faker.person.lastName()}`.toLowerCase();
        case 'hyphenated':
          return `${faker.person.firstName()}-${faker.person.lastName()}`.toLowerCase();
        case 'underscored':
          return `${faker.person.firstName()}_${faker.person.lastName()}`.toLowerCase();
        case 'lowercase':
          return faker.internet.username().toLowerCase();
        default:
          return faker.person.fullName();
      }
    }
    
    return faker.person.fullName();
  }

  private generateUserEmail(): string {
    if (this.patterns?.builds.creatorPatterns.domains) {
      const domain = this.selectByDistribution(
        this.patterns.builds.creatorPatterns.domains
      );
      return `${faker.internet.username()}@${domain}`.toLowerCase();
    }
    
    return faker.internet.email();
  }

  private generatePipelineSlug(): string {
    const format = this.patterns?.pipelines.slugFormats 
      ? this.selectByDistribution(this.patterns.pipelines.slugFormats)
      : 'kebab-case';
    
    const words = [faker.word.noun(), faker.word.verb()];
    
    switch (format) {
      case 'kebab-case':
        return words.join('-').toLowerCase();
      case 'snake_case':
        return words.join('_').toLowerCase();
      case 'camelCase':
        return words[0].toLowerCase() + words.slice(1).map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join('');
      default:
        return words.join('').toLowerCase();
    }
  }

  private generatePipelineName(): string {
    const length = this.patterns?.pipelines.nameLength?.average || 20;
    const variance = 10;
    const targetLength = Math.max(
      5,
      Math.floor(length + (Math.random() - 0.5) * variance)
    );
    
    let name = faker.company.name();
    while (name.length < targetLength) {
      name += ' ' + faker.word.noun();
    }
    
    return name.substring(0, targetLength);
  }

  private generateRepository() {
    const provider = this.patterns?.pipelines.repositoryProviders
      ? this.selectByDistribution(this.patterns.pipelines.repositoryProviders)
      : 'github';
    
    const org = faker.word.noun();
    const repo = faker.word.noun();
    
    switch (provider) {
      case 'github':
        return {
          url: `https://github.com/${org}/${repo}`,
          provider: { name: 'GitHub' }
        };
      case 'gitlab':
        return {
          url: `https://gitlab.com/${org}/${repo}`,
          provider: { name: 'GitLab' }
        };
      case 'bitbucket':
        return {
          url: `https://bitbucket.org/${org}/${repo}`,
          provider: { name: 'Bitbucket' }
        };
      default:
        return {
          url: `git@git.example.com:${org}/${repo}.git`,
          provider: { name: 'Git' }
        };
    }
  }

  private generateDefaultBranch(): string {
    if (this.patterns?.pipelines.defaultBranches) {
      return this.selectByDistribution(this.patterns.pipelines.defaultBranches);
    }
    return faker.helpers.arrayElement(['main', 'master', 'develop']);
  }

  private generateVisibility(): string {
    if (this.patterns?.pipelines.visibility) {
      return this.selectByDistribution(this.patterns.pipelines.visibility);
    }
    return faker.helpers.arrayElement(['PRIVATE', 'PUBLIC']);
  }

  private generateJobBase() {
    return {
      id: faker.string.uuid(),
      uuid: faker.string.uuid(),
      label: this.generateJobLabel(),
      state: this.generateJobState(),
      runAt: faker.date.recent({ days: 1 }).toISOString(),
      scheduledAt: faker.date.recent({ days: 1 }).toISOString(),
      startedAt: faker.date.recent({ days: 1 }).toISOString(),
      finishedAt: faker.date.recent({ days: 1 }).toISOString(),
      canceledAt: null,
      unblockable: faker.datatype.boolean({ probability: 0.1 }),
      unblockUrl: null,
      url: `https://buildkite.com/${faker.word.noun()}/${faker.word.noun()}/builds/${faker.number.int()}/jobs/${faker.string.uuid()}`,
      webUrl: `https://buildkite.com/${faker.word.noun()}/${faker.word.noun()}/builds/${faker.number.int()}#${faker.string.uuid()}`,
      build: { id: faker.string.uuid() }
    };
  }

  private generateJob() {
    const type = faker.helpers.arrayElement(['command', 'wait', 'trigger']);
    
    switch (type) {
      case 'wait':
        return { __typename: 'JobTypeWait' };
      case 'trigger':
        return { __typename: 'JobTypeTrigger' };
      default:
        return { __typename: 'JobTypeCommand' };
    }
  }

  private generateJobLabel(): string {
    if (this.patterns?.jobs.labelPatterns) {
      const pattern = this.selectByDistribution(this.patterns.jobs.labelPatterns);
      return pattern
        .replace(':version', faker.system.semver())
        .replace(':os', faker.helpers.arrayElement(['linux', 'ubuntu', 'macos', 'windows']))
        .replace(':test', faker.helpers.arrayElement(['unit', 'integration', 'e2e', 'smoke']))
        .replace(':sha', faker.git.commitSha().substring(0, 7));
    }
    
    return faker.helpers.arrayElement([
      `Test on ${faker.helpers.arrayElement(['Node', 'Python', 'Ruby'])} ${faker.system.semver()}`,
      'Build Docker Image',
      'Deploy to Staging',
      'Run Integration Tests',
      'Lint and Format',
      'Security Scan',
      'Performance Tests'
    ]);
  }

  private generateJobState(): string {
    return faker.helpers.arrayElement([
      'PENDING', 'WAITING', 'BLOCKED', 'UNBLOCKED', 'LIMITING',
      'LIMITED', 'SCHEDULED', 'ASSIGNED', 'ACCEPTED', 'RUNNING',
      'FINISHED', 'CANCELING', 'CANCELED', 'TIMING_OUT', 
      'TIMED_OUT', 'SKIPPED', 'BROKEN'
    ]);
  }

  private generateExitStatus(): number | null {
    if (this.patterns?.jobs.exitStatusDistribution) {
      return this.selectByDistribution(this.patterns.jobs.exitStatusDistribution);
    }
    
    const hasExitStatus = Math.random() < 0.95;
    if (!hasExitStatus) return null;
    
    // Most jobs succeed (0), some fail (1), rare other codes
    const random = Math.random();
    if (random < 0.85) return 0;
    if (random < 0.95) return 1;
    return faker.helpers.arrayElement([2, 127, 128, 130, 137]);
  }

  private generateParallelGroupIndex(): number | null {
    const hasParallel = Math.random() < 0.2;
    if (!hasParallel) return null;
    return faker.number.int({ min: 0, max: 9 });
  }

  private generateParallelGroupTotal(): number | null {
    const hasParallel = Math.random() < 0.2;
    if (!hasParallel) return null;
    return faker.number.int({ min: 2, max: 10 });
  }

  private generateAgent() {
    return {
      id: faker.string.uuid(),
      uuid: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        `agent-${faker.word.noun()}-${faker.number.int({ min: 1, max: 99 })}`,
        `buildkite-agent-${faker.string.alphanumeric(8)}`,
        `${faker.helpers.arrayElement(['linux', 'macos', 'windows'])}-${faker.number.int({ min: 1, max: 20 })}`
      ]),
      hostname: faker.internet.domainName(),
      version: faker.system.semver(),
      isRunningJob: faker.datatype.boolean({ probability: 0.3 })
    };
  }

  private generateOrganizationSlug(): string {
    const format = this.patterns?.organizations.slugFormats 
      ? this.selectByDistribution(this.patterns.organizations.slugFormats)
      : 'kebab-case';
    
    const name = faker.company.name().toLowerCase();
    
    switch (format) {
      case 'kebab-case':
        return name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      case 'snake_case':
        return name.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      default:
        return name.replace(/[^a-z0-9]/g, '');
    }
  }

  private generateOrganizationName(): string {
    const length = this.patterns?.organizations.nameLength?.average || 15;
    const variance = 10;
    const targetLength = Math.max(
      3,
      Math.floor(length + (Math.random() - 0.5) * variance)
    );
    
    let name = faker.company.name();
    while (name.length < targetLength) {
      name += ' ' + faker.company.buzzNoun();
    }
    
    return name.substring(0, targetLength);
  }

  private generatePipelineRef() {
    return {
      id: faker.string.uuid(),
      slug: this.generatePipelineSlug(),
      name: this.generatePipelineName()
    };
  }

  private generateOrganizationRef() {
    return {
      id: faker.string.uuid(),
      slug: this.generateOrganizationSlug(),
      name: this.generateOrganizationName()
    };
  }

  private generateAnnotationContext(): string {
    return faker.helpers.arrayElement([
      'test-results',
      'coverage',
      'lint',
      'security',
      'performance',
      'deployment',
      'release-notes'
    ]);
  }

  private generateAnnotationStyle(): string {
    return faker.helpers.arrayElement(['info', 'warning', 'error', 'success']);
  }

  private generateAnnotationBody(): string {
    const useMarkdown = Math.random() < 0.6;
    
    if (useMarkdown) {
      const style = faker.helpers.arrayElement(['summary', 'detailed', 'table']);
      
      switch (style) {
        case 'summary':
          return `<h3>${faker.lorem.sentence()}</h3>
<p>${faker.lorem.paragraph()}</p>
<ul>
  <li>✅ ${faker.lorem.sentence()}</li>
  <li>⚠️  ${faker.lorem.sentence()}</li>
  <li>❌ ${faker.lorem.sentence()}</li>
</ul>`;
        
        case 'detailed':
          return `<details>
  <summary>${faker.lorem.sentence()}</summary>
  <p>${faker.lorem.paragraph()}</p>
  <pre><code>${faker.hacker.phrase()}</code></pre>
</details>`;
        
        case 'table':
          return `<table>
  <thead>
    <tr>
      <th>Test</th>
      <th>Status</th>
      <th>Duration</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>${faker.hacker.noun()}</td>
      <td>✅ Passed</td>
      <td>${faker.number.float({ min: 0.1, max: 10, multipleOf: 0.1 })}s</td>
    </tr>
    <tr>
      <td>${faker.hacker.noun()}</td>
      <td>❌ Failed</td>
      <td>${faker.number.float({ min: 0.1, max: 10, multipleOf: 0.1 })}s</td>
    </tr>
  </tbody>
</table>`;
        
        default:
          return `<p>${faker.lorem.paragraph()}</p>`;
      }
    }
    
    return `<p>${faker.lorem.paragraph()}</p>`;
  }
}
