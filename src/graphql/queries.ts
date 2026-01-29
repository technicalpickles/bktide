/**
 * Common GraphQL queries for the Buildkite API
 */
import { gql } from 'graphql-request';
import { JOB_SUMMARY_FIELDS, JOB_DETAIL_FIELDS } from './fragments/index.js';

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

export const GET_PIPELINE = gql`
  query GetPipeline($organizationSlug: ID!, $pipelineSlug: String!) {
    organization(slug: $organizationSlug) {
      pipelines(first: 50, search: $pipelineSlug) {
        edges {
          node {
            uuid
            id
            name
            slug
            description
            url
            defaultBranch
            repository {
              url
            }
          }
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
            ...JobSummaryFields
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        count
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
  ${JOB_SUMMARY_FIELDS}
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
            ...JobDetailFields
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        count
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
  ${JOB_DETAIL_FIELDS}
`;

export const GET_BUILD_JOBS_PAGE = gql`
  query GetBuildJobsPage($slug: ID!, $first: Int!, $after: String) {
    build(slug: $slug) {
      id
      jobs(first: $first, after: $after) {
        edges {
          node {
            ...JobSummaryFields
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        count
      }
    }
  }
  ${JOB_SUMMARY_FIELDS}
`;

export const GET_BUILD_ANNOTATION_TIMESTAMPS = gql`
  query GetBuildAnnotationTimestamps($slug: ID!) {
    build(slug: $slug) {
      annotations(first: 100) {
        edges {
          node {
            uuid
            updatedAt
            createdAt
          }
        }
      }
    }
  }
`;

export const GET_BUILD_ANNOTATIONS_FULL = gql`
  query GetBuildAnnotationsFull($slug: ID!) {
    build(slug: $slug) {
      annotations(first: 100) {
        edges {
          node {
            uuid
            context
            style
            body {
              html
              text
            }
            createdAt
            updatedAt
          }
        }
      }
    }
  }
`; 