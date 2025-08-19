import { gql } from 'graphql-request';

/**
 * Fragment for basic job fields used in summary views
 * This is the minimal set of fields needed for job lists
 */
export const JOB_SUMMARY_FIELDS = gql`
  fragment JobSummaryFields on JobInterface {
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
`;

/**
 * Fragment for detailed job fields used in full views
 * Includes all summary fields plus additional details
 */
export const JOB_DETAIL_FIELDS = gql`
  fragment JobDetailFields on JobInterface {
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
`;

/**
 * Fragment for jobs connection with pagination info
 * Can be used with either summary or detail fields
 */
export const JOBS_CONNECTION = gql`
  fragment JobsConnection on JobConnection {
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
  ${JOB_SUMMARY_FIELDS}
`;

/**
 * Fragment for detailed jobs connection
 */
export const JOBS_CONNECTION_DETAILED = gql`
  fragment JobsConnectionDetailed on JobConnection {
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
  ${JOB_DETAIL_FIELDS}
`;
