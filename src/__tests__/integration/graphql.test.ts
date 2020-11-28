import _ from 'lodash';
import { ApolloClient, gql, InMemoryCache, HttpLink } from '@apollo/client/core';
import fetch from 'cross-fetch';
import { v4 as uuidv4 } from 'uuid';

import { setupTestApp, shutdownTestApp, PROJECT_TABLE_NAME, PROJECT_AMOUNT } from '../setup/app';
import environment from '../../environment';

const getClient = () => {
  const {
    DEFAULT_HTTP_PORT
  } = environment.env;
  const client = new ApolloClient({
    link: new HttpLink({ 
      uri: `http://localhost:${DEFAULT_HTTP_PORT}/graphql?admin`, 
      fetch,
    }),
    cache: new InMemoryCache(),
  });

  return client;
}

describe('graphql', () => {
  beforeAll(async () => {
    await setupTestApp();
  });
  afterAll(async () => {
    await shutdownTestApp();
  });

  // it('temporary delay to keep test server open', async() => {
  //   await new Promise((resolve) => {
  //     setTimeout(() => {
  //       resolve();
  //     }, 100000);
  //   })
  // }, 100000);

  it('should create schema', async () => {
    const client = getClient();
    const result = await client.query({
      query: gql`
        {
          __typename
        }
      `,
    });

    expect(result.data.__typename).toBe('Query');
  });

  it('should query projects', async () => {
    const client = getClient();
    const result = await client.query({
      query: gql`
        {
          projects {
            nodes {
              id
            }
          }
        }
      `,
    });

    expect(result?.data?.projects?.nodes).toHaveLength(PROJECT_AMOUNT);
  });

  it('should update project name', async () => {
    const client = getClient();
    const newProjectName = `updated-${uuidv4()}`;
    const firstProjectResult = await client.query({
      query: gql`
        {
          projects(first: 1) {
            nodes {
              id
            }
          }
        }
      `,
    });
    const firstProjectId = firstProjectResult?.data?.projects?.nodes?.[0]?.id;
    const updateResult = await client.mutate({
      mutation: gql`
        mutation ($id: UUID!, $name: String!) {
          updateProject(input: {
            id: $id,
            patch: {
              name: $name
            }
          }) {
            project {
              name
            }
          }
        }
      `,
      variables: {
        id: firstProjectId,
        name: newProjectName,
      }
    });

    expect(updateResult?.data?.updateProject?.project?.name).toBe(newProjectName);
  });
});