/**
 * Common GraphQL queries for the Buildkite API
 */

export const GET_VIEWER = `
  query {
    viewer {
      id
      user {
        id
        uuid
        name
        email
      }
    }
  }
`;

export const GET_ORGANIZATIONS = `
  query {
    organizations {
      edges {
        node {
          id
          name
          slug
        }
      }
    }
  }
`;

export const GET_PIPELINES = `
  query GetPipelines($organizationSlug: ID!, $first: Int, $after: String) {
    organization(slug: $organizationSlug) {
      pipelines(first: $first, after: $after) {
        edges {
          node {
            id
            name
            slug
            description
            url
            repository {
              url
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const GET_BUILDS = `
  query GetBuilds($pipelineSlug: ID!, $organizationSlug: ID!, $first: Int) {
    pipeline(slug: $pipelineSlug, organization: $organizationSlug) {
      builds(first: $first) {
        edges {
          node {
            id
            number
            url
            state
            message
            commit
            branch
            createdAt
            startedAt
            finishedAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const GET_VIEWER_BUILDS = `
  query GetViewerBuilds($first: Int!) {
    viewer {
      builds(first: $first) {
        edges {
          node {
            id
            number
            state
            url
            createdAt
            branch
            message
            pipeline {
              name
              slug
            }
            organization {
              name
              slug
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`; 