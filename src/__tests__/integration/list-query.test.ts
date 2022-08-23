import _ from 'lodash';
import { gql } from 'graphql-request';

import { setupTestApp, shutdownTestApp, PROJECT_AMOUNT } from '../setup/app';
import { executeRequest } from '../helpers';

describe('list query', () => {
  beforeAll(async () => {
    await setupTestApp();
  });
  afterAll(async () => {
    await shutdownTestApp();
  });

  it('should query projects', async () => {
    const result = await executeRequest(gql`
      {
        projects {
          nodes {
            id
          }
        }
      }
    `);

    expect(result?.projects?.nodes).toHaveLength(PROJECT_AMOUNT);
  });
});
