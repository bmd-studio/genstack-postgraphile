import _ from 'lodash';
import { gql } from 'graphql-request';
import { v4 as uuidv4 } from 'uuid';

import { setupTestApp, shutdownTestApp } from '../setup/app';
import { executeRequest } from '../helpers';

describe('update mutation', () => {
  beforeAll(async () => {
    await setupTestApp();
  });
  afterAll(async () => {
    await shutdownTestApp();
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
