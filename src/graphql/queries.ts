/**
 * Common GraphQL queries for the Buildkite API
 */

export const GET_VIEWER = `
  query {
    viewer {
      id
      email
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
  query GetPipelines($organizationSlug: ID!, $first: Int) {
    organization(slug: $organizationSlug) {
      pipelines(first: $first) {
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