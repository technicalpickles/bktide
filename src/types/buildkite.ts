/**
 * Common types for Buildkite GraphQL API
 */

export interface PipelineNode {
  id: string;
  name: string;
  slug: string;
  description: string;
  url: string;
  repository: {
    url: string;
  };
}

export interface BuildNode {
  id: string;
  number: number;
  url: string;
  state: string;
  message: string;
  commit: string;
  branch: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface OrganizationNode {
  id: string;
  name: string;
  slug: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string;
  endCursor: string;
}

/**
 * Job log response from Buildkite REST API
 */
export interface JobLog {
  /** URL to the raw log file */
  url: string;
  /** Raw ANSI log content */
  content: string;
  /** Size in bytes */
  size: number;
  /** Header timing information */
  header_times: number[];
} 