/**
 * Common GraphQL queries for the Buildkite API
 */
import { gql } from 'graphql-request';

export const GET_VIEWER = gql`
  query GetViewer {
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

export const GET_ORGANIZATIONS = gql`
  query GetOrganizations {
    viewer {
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
  }
`;

export const GET_PIPELINES = gql`
  query GetPipelines($organizationSlug: ID!, $first: Int, $after: String) {
    organization(slug: $organizationSlug) {
      pipelines(first: $first, after: $after, archived: false) {
        edges {
          node {
            uuid
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

export const GET_BUILDS = gql`
  query GetBuilds($pipelineSlug: String!, $organizationSlug: ID!, $first: Int) {
    organization(slug: $organizationSlug) {
      pipelines(first: 1, search: $pipelineSlug) {
        edges {
          node {
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
      }
    }
  }
`;

export const GET_VIEWER_BUILDS = gql`
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

export const GET_BUILD_ANNOTATIONS = gql`
  query GetBuildAnnotations($buildSlug: ID!) {
    build(slug: $buildSlug) {
      annotations(first: 100) {
        edges {
          node {
            context
            style
            body {
              html
            }
          }
        }
      }
    }
  }
`;

export const GET_BUILD_SUMMARY = gql`
  query GetBuildSummary($slug: ID!) {
    build(slug: $slug) {
      id
      number
      state
      branch
      message
      commit
      createdAt
      startedAt
      finishedAt
      canceledAt
      url
      blockedState
      createdBy {
        ... on User {
          id
          name
          email
          avatar {
            url
          }
        }
        ... on UnregisteredUser {
          name
          email
        }
      }
      pipeline {
        id
        name
        slug
      }
      organization {
        id
        name
        slug
      }
      jobs(first: 100) {
        edges {
          node {
            ... on JobTypeCommand {
              id
              uuid
              label
              state
              exitStatus
              startedAt
              finishedAt
              passed
              parallelGroupIndex
              parallelGroupTotal
            }
            ... on JobTypeWait {
              id
              label
            }
            ... on JobTypeTrigger {
              id
              label
              state
            }
          }
        }
      }
      annotations(first: 50) {
        edges {
          node {
            id
            style
            context
            body {
              html
            }
          }
        }
      }
    }
  }
`;

export const GET_BUILD_FULL = gql`
  query GetBuildFull($slug: ID!) {
    build(slug: $slug) {
      id
      number
      state
      branch
      message
      commit
      createdAt
      startedAt
      finishedAt
      canceledAt
      url
      blockedState
      createdBy {
        ... on User {
          id
          name
          email
          avatar {
            url
          }
        }
        ... on UnregisteredUser {
          name
          email
        }
      }
      pipeline {
        id
        name
        slug
        repository {
          url
        }
      }
      organization {
        id
        name
        slug
      }
      pullRequest {
        id
      }
      jobs(first: 100) {
        edges {
          node {
            ... on JobTypeCommand {
              id
              uuid
              label
              command
              state
              exitStatus
              startedAt
              finishedAt
              passed
              retried
              parallelGroupIndex
              parallelGroupTotal
              retrySource {
                ... on JobTypeCommand {
                  id
                  uuid
                }
              }
              agent {
                ... on Agent {
                  id
                  name
                  hostname
                }
              }
            }
            ... on JobTypeWait {
              id
              label
            }
            ... on JobTypeTrigger {
              id
              label
              state
            }
          }
        }
      }
      annotations(first: 100) {
        edges {
          node {
            id
            style
            context
            body {
              html
            }
            createdAt
            updatedAt
          }
        }
      }
    }
  }
`; 