// Buildkite GraphQL API response types

// Viewer types
export interface ViewerUser {
  id: string;
  uuid: string;
  name: string;
  email: string;
}

export interface Viewer {
  id: string;
  user?: ViewerUser;
}

export interface ViewerData {
  viewer: Viewer;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
}

// Pipeline types
export interface Repository {
  url: string;
}

export interface Pipeline {
  uuid: string;
  id: string;
  name: string;
  slug: string;
  description?: string;
  url?: string;
  organization?: string;
  repository?: Repository;
}

// Build types
export interface BuildPipeline {
  name: string;
  slug: string;
}

export interface BuildOrganization {
  name: string;
  slug: string;
}

export interface Build {
  id: string;
  number: number;
  url?: string;
  web_url?: string;
  state?: string;
  message?: string;
  commit?: string;
  branch?: string;
  createdAt?: string;
  created_at?: string;
  startedAt?: string;
  started_at?: string;
  finishedAt?: string;
  finished_at?: string;
  pipeline?: BuildPipeline;
  organization?: BuildOrganization;
}

// Annotation types
export interface Annotation {
  id: string;
  context: string;
  style: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

// GraphQL API response structure types
export interface GraphQLEdge<T> {
  node: T;
}

export interface GraphQLConnection<T> {
  edges: GraphQLEdge<T>[];
  pageInfo?: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

export interface ViewerOrganizationsData {
  viewer: {
    organizations: GraphQLConnection<Organization>;
  };
}

export interface PipelineQueryResponse {
  organization: {
    pipelines: GraphQLConnection<Pipeline>;
  };
}

export interface ViewerBuildsQueryResponse {
  viewer: {
    builds: GraphQLConnection<Build>;
  };
}

export interface OrganizationsQueryResponse {
  viewer: {
    organizations: GraphQLConnection<Organization>;
  };
} 