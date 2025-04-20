/* eslint-disable */
import * as types from './graphql.js';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query GetViewer {\n    viewer {\n      id\n      user {\n        id\n        uuid\n        name\n        email\n      }\n    }\n  }\n": typeof types.GetViewerDocument,
    "\n  query GetOrganizations {\n    viewer {\n      organizations {\n        edges {\n          node {\n            id\n            name\n            slug\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetOrganizationsDocument,
    "\n  query GetPipelines($organizationSlug: ID!, $first: Int, $after: String) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: $first, after: $after) {\n        edges {\n          node {\n            uuid\n            id\n            name\n            slug\n            description\n            url\n            repository {\n              url\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n": typeof types.GetPipelinesDocument,
    "\n  query GetBuilds($pipelineSlug: String!, $organizationSlug: ID!, $first: Int) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: 1, search: $pipelineSlug) {\n        edges {\n          node {\n            builds(first: $first) {\n              edges {\n                node {\n                  id\n                  number\n                  url\n                  state\n                  message\n                  commit\n                  branch\n                  createdAt\n                  startedAt\n                  finishedAt\n                }\n              }\n              pageInfo {\n                hasNextPage\n                endCursor\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": typeof types.GetBuildsDocument,
    "\n  query GetViewerBuilds($first: Int!) {\n    viewer {\n      builds(first: $first) {\n        edges {\n          node {\n            id\n            number\n            state\n            url\n            createdAt\n            branch\n            message\n            pipeline {\n              name\n              slug\n            }\n            organization {\n              name\n              slug\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n": typeof types.GetViewerBuildsDocument,
};
const documents: Documents = {
    "\n  query GetViewer {\n    viewer {\n      id\n      user {\n        id\n        uuid\n        name\n        email\n      }\n    }\n  }\n": types.GetViewerDocument,
    "\n  query GetOrganizations {\n    viewer {\n      organizations {\n        edges {\n          node {\n            id\n            name\n            slug\n          }\n        }\n      }\n    }\n  }\n": types.GetOrganizationsDocument,
    "\n  query GetPipelines($organizationSlug: ID!, $first: Int, $after: String) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: $first, after: $after) {\n        edges {\n          node {\n            uuid\n            id\n            name\n            slug\n            description\n            url\n            repository {\n              url\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n": types.GetPipelinesDocument,
    "\n  query GetBuilds($pipelineSlug: String!, $organizationSlug: ID!, $first: Int) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: 1, search: $pipelineSlug) {\n        edges {\n          node {\n            builds(first: $first) {\n              edges {\n                node {\n                  id\n                  number\n                  url\n                  state\n                  message\n                  commit\n                  branch\n                  createdAt\n                  startedAt\n                  finishedAt\n                }\n              }\n              pageInfo {\n                hasNextPage\n                endCursor\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetBuildsDocument,
    "\n  query GetViewerBuilds($first: Int!) {\n    viewer {\n      builds(first: $first) {\n        edges {\n          node {\n            id\n            number\n            state\n            url\n            createdAt\n            branch\n            message\n            pipeline {\n              name\n              slug\n            }\n            organization {\n              name\n              slug\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n": types.GetViewerBuildsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetViewer {\n    viewer {\n      id\n      user {\n        id\n        uuid\n        name\n        email\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetViewer {\n    viewer {\n      id\n      user {\n        id\n        uuid\n        name\n        email\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetOrganizations {\n    viewer {\n      organizations {\n        edges {\n          node {\n            id\n            name\n            slug\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetOrganizations {\n    viewer {\n      organizations {\n        edges {\n          node {\n            id\n            name\n            slug\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPipelines($organizationSlug: ID!, $first: Int, $after: String) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: $first, after: $after) {\n        edges {\n          node {\n            uuid\n            id\n            name\n            slug\n            description\n            url\n            repository {\n              url\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetPipelines($organizationSlug: ID!, $first: Int, $after: String) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: $first, after: $after) {\n        edges {\n          node {\n            uuid\n            id\n            name\n            slug\n            description\n            url\n            repository {\n              url\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetBuilds($pipelineSlug: String!, $organizationSlug: ID!, $first: Int) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: 1, search: $pipelineSlug) {\n        edges {\n          node {\n            builds(first: $first) {\n              edges {\n                node {\n                  id\n                  number\n                  url\n                  state\n                  message\n                  commit\n                  branch\n                  createdAt\n                  startedAt\n                  finishedAt\n                }\n              }\n              pageInfo {\n                hasNextPage\n                endCursor\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetBuilds($pipelineSlug: String!, $organizationSlug: ID!, $first: Int) {\n    organization(slug: $organizationSlug) {\n      pipelines(first: 1, search: $pipelineSlug) {\n        edges {\n          node {\n            builds(first: $first) {\n              edges {\n                node {\n                  id\n                  number\n                  url\n                  state\n                  message\n                  commit\n                  branch\n                  createdAt\n                  startedAt\n                  finishedAt\n                }\n              }\n              pageInfo {\n                hasNextPage\n                endCursor\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetViewerBuilds($first: Int!) {\n    viewer {\n      builds(first: $first) {\n        edges {\n          node {\n            id\n            number\n            state\n            url\n            createdAt\n            branch\n            message\n            pipeline {\n              name\n              slug\n            }\n            organization {\n              name\n              slug\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetViewerBuilds($first: Int!) {\n    viewer {\n      builds(first: $first) {\n        edges {\n          node {\n            id\n            number\n            state\n            url\n            createdAt\n            branch\n            message\n            pipeline {\n              name\n              slug\n            }\n            organization {\n              name\n              slug\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;