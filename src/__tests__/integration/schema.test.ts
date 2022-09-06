import _ from 'lodash';
import { gql } from 'graphql-request';
import { v4 as uuidv4 } from 'uuid';

import { setupTestApp, shutdownTestApp, PROJECT_AMOUNT, DEFAULT_PROJECT_POSITION } from '../setup/app';
import { executeRequest } from '../helpers';

describe('schema', () => {
  beforeAll(async () => {
    await setupTestApp();
  });
  afterAll(async () => {
    await shutdownTestApp();
  });

  // it('temporary delay to keep test server open', async() => {
  //   await new Promise<void>((resolve) => {
  //     setTimeout(() => {
  //       resolve();
  //     }, 100000);
  //   })
  // }, 100000);

  it('should create schema', async () => {
    const result = await executeRequest(gql`
      {
        __typename
      }
    `);

    expect(result.__typename).toBe('Query');
  });

  it('should query projects', async () => {
    const result = await executeRequest(gql`
      {
        projects(orderBy: [POSITION_ASC]) {
          nodes {
            id
          }
        }
      }
    `);

    expect(result?.projects?.nodes).toHaveLength(PROJECT_AMOUNT);
  });

  it('should query project position sum aggregate', async () => {
    const result = await executeRequest(gql`
      {
        projects {
          aggregates {
            sum {
              position
            }
          }
        }
      }
    `);

    expect(parseInt(result?.projects?.aggregates?.sum?.position ?? -1)).toBe(PROJECT_AMOUNT * DEFAULT_PROJECT_POSITION);
  });

  it('should update project name', async () => {
    const newProjectName = `updated-${uuidv4()}`;
    const firstProjectResult = await executeRequest(gql`
      {
        projects(first: 1) {
          nodes {
            id
          }
        }
      }
    `);
    const firstProjectId = firstProjectResult?.projects?.nodes?.[0]?.id;
    const updateResult = await executeRequest(gql`
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
    `, {
      id: firstProjectId,
      name: newProjectName,
    });

    expect(updateResult?.updateProject?.project?.name).toBe(newProjectName);
  });
});
