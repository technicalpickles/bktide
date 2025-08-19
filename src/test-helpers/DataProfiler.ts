/**
 * DataProfiler extracts statistical patterns from real data without storing sensitive information
 */

import type { 
  Build, 
  Pipeline, 
  Organization, 
  Job,
  BuildStates
} from '../../src/graphql/generated/graphql.js';

export interface Distribution<T> {
  values: Array<{
    value: T;
    frequency: number;
    count: number;
  }>;
  total?: number;
}

export interface BuildPatterns {
  states: Distribution<BuildStates>;
  branches: BranchPatterns;
  messagePatterns: MessagePatterns;
  numberRange: { min: number; max: number };
  duration: DurationPatterns;
  jobCounts: Distribution<number>;
  annotationCounts: Distribution<number>;
  creatorPatterns: CreatorPatterns;
}

export interface BranchPatterns {
  common: Distribution<string>;
  formats: {
    feature: number;
    bugfix: number;
    release: number;
    main: number;
    custom: number;
  };
  averageLength: number;
}

export interface MessagePatterns {
  averageLength: number;
  hasEmoji: number;
  conventionalCommits: number;
  commonPrefixes: Distribution<string>;
  githubRefs: number;
  jiraRefs: number;
  multiline: number;
}

export interface DurationPatterns {
  min: number;
  max: number;
  median: number;
  p95: number;
  average: number;
}

export interface CreatorPatterns {
  nameFormats: Distribution<string>;
  domains: Distribution<string>;
  botUsers: number;
}

export interface PipelinePatterns {
  slugFormats: Distribution<string>;
  nameLength: { min: number; max: number; average: number };
  defaultBranches: Distribution<string>;
  hasDescription: number;
  repositoryProviders: Distribution<string>;
  visibility: Distribution<string>;
}

export interface JobPatterns {
  states: Distribution<string>;
  labelPatterns: Distribution<string>;
  exitStatusDistribution: Distribution<number | null>;
  retryRates: {
    automatic: number;
    manual: number;
  };
  parallelGroups: Distribution<number>;
  durationPatterns: DurationPatterns;
}

export interface OrganizationPatterns {
  slugFormats: Distribution<string>;
  nameLength: { min: number; max: number; average: number };
  pipelineCount: Distribution<number>;
  memberCount: Distribution<number>;
}

export interface DataPatterns {
  builds: BuildPatterns;
  pipelines: PipelinePatterns;
  jobs: JobPatterns;
  organizations: OrganizationPatterns;
  extracted: string;
  sampleSize: {
    builds: number;
    pipelines: number;
    jobs: number;
    organizations: number;
  };
}

export class DataProfiler {
  profileBuilds(builds: Build[]): BuildPatterns {
    if (!builds || builds.length === 0) {
      return this.getEmptyBuildPatterns();
    }

    return {
      states: this.getDistribution(builds.map(b => b.state)),
      branches: this.analyzeBranches(builds.map(b => b.branch || 'unknown')),
      messagePatterns: this.analyzeMessages(builds.map(b => b.message || '')),
      numberRange: {
        min: Math.min(...builds.map(b => b.number || 0)),
        max: Math.max(...builds.map(b => b.number || 0))
      },
      duration: this.analyzeDurations(builds),
      jobCounts: this.getDistribution(
        builds.map(b => b.jobs?.edges?.length || 0)
      ),
      annotationCounts: this.getDistribution(
        builds.map(b => b.annotations?.edges?.length || 0)
      ),
      creatorPatterns: this.analyzeCreators(builds)
    };
  }

  profilePipelines(pipelines: Pipeline[]): PipelinePatterns {
    if (!pipelines || pipelines.length === 0) {
      return this.getEmptyPipelinePatterns();
    }

    const names = pipelines.map(p => p.name || '');
    const slugs = pipelines.map(p => p.slug || '');

    return {
      slugFormats: this.analyzeSlugFormats(slugs),
      nameLength: {
        min: Math.min(...names.map(n => n.length)),
        max: Math.max(...names.map(n => n.length)),
        average: names.reduce((acc, n) => acc + n.length, 0) / names.length
      },
      defaultBranches: this.getDistribution(
        pipelines.map(p => p.defaultBranch || 'main')
      ),
      hasDescription: pipelines.filter(p => p.description).length / pipelines.length,
      repositoryProviders: this.getDistribution(
        pipelines.map(p => this.extractRepoProvider(p.repository?.url))
      ),
      visibility: this.getDistribution(
        pipelines.map(p => p.visibility || 'PRIVATE')
      )
    };
  }

  profileJobs(jobs: Job[]): JobPatterns {
    if (!jobs || jobs.length === 0) {
      return this.getEmptyJobPatterns();
    }

    return {
      states: this.getDistribution(jobs.map(j => j.__typename || 'JobTypeCommand')),
      labelPatterns: this.analyzeJobLabels(jobs),
      exitStatusDistribution: this.getDistribution(
        jobs.map(j => 'exitStatus' in j ? (j.exitStatus as number | null) : null)
      ),
      retryRates: {
        automatic: jobs.filter(j => 'retriedAutomatically' in j && j.retriedAutomatically).length / jobs.length,
        manual: jobs.filter(j => 'retriedManually' in j && j.retriedManually).length / jobs.length
      },
      parallelGroups: this.getDistribution(
        jobs.map(j => 'parallelGroupTotal' in j ? j.parallelGroupTotal || 1 : 1)
      ),
      durationPatterns: this.analyzeJobDurations(jobs)
    };
  }

  profileOrganizations(orgs: Organization[]): OrganizationPatterns {
    if (!orgs || orgs.length === 0) {
      return this.getEmptyOrganizationPatterns();
    }

    const names = orgs.map(o => o.name || '');
    const slugs = orgs.map(o => o.slug || '');

    return {
      slugFormats: this.analyzeSlugFormats(slugs),
      nameLength: {
        min: Math.min(...names.map(n => n.length)),
        max: Math.max(...names.map(n => n.length)),
        average: names.reduce((acc, n) => acc + n.length, 0) / names.length
      },
      pipelineCount: this.getDistribution(
        orgs.map(o => o.pipelines?.edges?.length || 0)
      ),
      memberCount: this.getDistribution(
        orgs.map(o => o.members?.edges?.length || 0)
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
      })).sort((a, b) => b.frequency - a.frequency),
      total
    };
    
    return distribution;
  }

  private analyzeBranches(branches: string[]): BranchPatterns {
    const formats = {
      feature: branches.filter(b => b.startsWith('feature/')).length / branches.length,
      bugfix: branches.filter(b => b.startsWith('bugfix/') || b.startsWith('fix/')).length / branches.length,
      release: branches.filter(b => b.match(/^release\/\d+\.\d+/)).length / branches.length,
      main: branches.filter(b => ['main', 'master', 'develop'].includes(b)).length / branches.length,
      custom: 0
    };
    
    formats.custom = 1 - (formats.feature + formats.bugfix + formats.release + formats.main);

    return {
      common: this.getDistribution(this.getCommonPrefixes(branches)),
      formats,
      averageLength: branches.reduce((acc, b) => acc + b.length, 0) / branches.length
    };
  }

  private analyzeMessages(messages: string[]): MessagePatterns {
    const nonEmpty = messages.filter(m => m.length > 0);
    if (nonEmpty.length === 0) {
      return {
        averageLength: 0,
        hasEmoji: 0,
        conventionalCommits: 0,
        commonPrefixes: { values: [], total: 0 },
        githubRefs: 0,
        jiraRefs: 0,
        multiline: 0
      };
    }

    return {
      averageLength: nonEmpty.reduce((acc, m) => acc + m.length, 0) / nonEmpty.length,
      hasEmoji: nonEmpty.filter(m => /[🎉🚀✨🔧📦👷‍♂️🐛⚡️✅💚🔥]/.test(m)).length / nonEmpty.length,
      conventionalCommits: nonEmpty.filter(m => 
        /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/.test(m)
      ).length / nonEmpty.length,
      commonPrefixes: this.getDistribution(this.getCommonPrefixes(nonEmpty)),
      githubRefs: nonEmpty.filter(m => /#\d+/.test(m)).length / nonEmpty.length,
      jiraRefs: nonEmpty.filter(m => /[A-Z]{2,}-\d+/.test(m)).length / nonEmpty.length,
      multiline: nonEmpty.filter(m => m.includes('\n')).length / nonEmpty.length
    };
  }

  private analyzeDurations(builds: Build[]): DurationPatterns {
    const durations = builds
      .filter(b => b.startedAt && b.finishedAt)
      .map(b => new Date(b.finishedAt!).getTime() - new Date(b.startedAt!).getTime());
    
    if (durations.length === 0) {
      return { min: 0, max: 0, median: 0, p95: 0, average: 0 };
    }
    
    durations.sort((a, b) => a - b);
    
    return {
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      average: durations.reduce((acc, d) => acc + d, 0) / durations.length
    };
  }

  private analyzeJobDurations(jobs: Job[]): DurationPatterns {
    const durations = jobs
      .filter(j => 'startedAt' in j && 'finishedAt' in j)
      .map(j => {
        const job = j as any; // Type assertion for jobs with these fields
        if (job.startedAt && job.finishedAt) {
          return new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
        }
        return null;
      })
      .filter((d): d is number => d !== null);
    
    if (durations.length === 0) {
      return { min: 0, max: 0, median: 0, p95: 0, average: 0 };
    }
    
    durations.sort((a, b) => a - b);
    
    return {
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      average: durations.reduce((acc, d) => acc + d, 0) / durations.length
    };
  }

  private analyzeCreators(builds: Build[]): CreatorPatterns {
    const creators = builds.map(b => b.createdBy);
    const emails = creators
      .map(c => c?.email || '')
      .filter(e => e.length > 0);
    
    const domains = emails.map(e => e.split('@')[1] || 'unknown');
    const names = creators.map(c => c?.name || 'unknown');
    
    return {
      nameFormats: this.getDistribution(
        names.map(n => this.classifyNameFormat(n))
      ),
      domains: this.getDistribution(domains),
      botUsers: creators.filter(c => 
        c?.name?.toLowerCase().includes('bot') ||
        c?.email?.toLowerCase().includes('bot') ||
        c?.name?.toLowerCase().includes('[bot]')
      ).length / creators.length
    };
  }

  private analyzeSlugFormats(slugs: string[]): Distribution<string> {
    const formats = slugs.map(s => {
      if (s.includes('-')) return 'kebab-case';
      if (s.includes('_')) return 'snake_case';
      if (s.match(/[A-Z]/)) return 'camelCase';
      return 'lowercase';
    });
    
    return this.getDistribution(formats);
  }

  private analyzeJobLabels(jobs: Job[]): Distribution<string> {
    const labels = jobs
      .map(j => 'label' in j ? j.label : null)
      .filter((l): l is string => l !== null);
    
    // Extract common patterns
    const patterns = labels.map(l => {
      // Replace common variables with placeholders
      return l
        .replace(/\d+\.\d+\.\d+/g, ':version')
        .replace(/node-\d+/gi, 'node-:version')
        .replace(/python-\d+\.\d+/gi, 'python-:version')
        .replace(/ruby-\d+\.\d+/gi, 'ruby-:version')
        .replace(/(linux|ubuntu|macos|windows|darwin)/gi, ':os')
        .replace(/(test|tests|spec|specs)/gi, ':test')
        .replace(/\b[a-f0-9]{7,40}\b/g, ':sha');
    });
    
    return this.getDistribution(patterns);
  }

  private getCommonPrefixes(strings: string[], maxLength = 50): string[] {
    const prefixes: string[] = [];
    
    strings.forEach(str => {
      const words = str.split(/[\s\-_/:]+/).filter(w => w.length > 0);
      if (words.length > 0) {
        prefixes.push(words[0].substring(0, maxLength));
      }
    });
    
    return prefixes;
  }

  private extractRepoProvider(url?: string): string {
    if (!url) return 'unknown';
    if (url.includes('github.com')) return 'github';
    if (url.includes('gitlab.com')) return 'gitlab';
    if (url.includes('bitbucket.org')) return 'bitbucket';
    if (url.includes('git')) return 'git';
    return 'other';
  }

  private classifyNameFormat(name: string): string {
    if (name.includes(' ')) return 'full-name';
    if (name.includes('.')) return 'dotted';
    if (name.includes('-')) return 'hyphenated';
    if (name.includes('_')) return 'underscored';
    if (name.match(/^[a-z]+$/)) return 'lowercase';
    if (name.match(/^[A-Z]+$/)) return 'uppercase';
    return 'mixed';
  }

  // Empty pattern generators for fallback
  private getEmptyBuildPatterns(): BuildPatterns {
    return {
      states: { values: [], total: 0 },
      branches: {
        common: { values: [], total: 0 },
        formats: { feature: 0, bugfix: 0, release: 0, main: 0, custom: 0 },
        averageLength: 0
      },
      messagePatterns: {
        averageLength: 0,
        hasEmoji: 0,
        conventionalCommits: 0,
        commonPrefixes: { values: [], total: 0 },
        githubRefs: 0,
        jiraRefs: 0,
        multiline: 0
      },
      numberRange: { min: 0, max: 0 },
      duration: { min: 0, max: 0, median: 0, p95: 0, average: 0 },
      jobCounts: { values: [], total: 0 },
      annotationCounts: { values: [], total: 0 },
      creatorPatterns: {
        nameFormats: { values: [], total: 0 },
        domains: { values: [], total: 0 },
        botUsers: 0
      }
    };
  }

  private getEmptyPipelinePatterns(): PipelinePatterns {
    return {
      slugFormats: { values: [], total: 0 },
      nameLength: { min: 0, max: 0, average: 0 },
      defaultBranches: { values: [], total: 0 },
      hasDescription: 0,
      repositoryProviders: { values: [], total: 0 },
      visibility: { values: [], total: 0 }
    };
  }

  private getEmptyJobPatterns(): JobPatterns {
    return {
      states: { values: [], total: 0 },
      labelPatterns: { values: [], total: 0 },
      exitStatusDistribution: { values: [], total: 0 },
      retryRates: { automatic: 0, manual: 0 },
      parallelGroups: { values: [], total: 0 },
      durationPatterns: { min: 0, max: 0, median: 0, p95: 0, average: 0 }
    };
  }

  private getEmptyOrganizationPatterns(): OrganizationPatterns {
    return {
      slugFormats: { values: [], total: 0 },
      nameLength: { min: 0, max: 0, average: 0 },
      pipelineCount: { values: [], total: 0 },
      memberCount: { values: [], total: 0 }
    };
  }
}
