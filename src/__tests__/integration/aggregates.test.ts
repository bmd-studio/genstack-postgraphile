import _ from 'lodash';
import { gql } from 'graphql-request';

import { setupTestApp, shutdownTestApp, PROJECT_AMOUNT, DEFAULT_PROJECT_POSITION } from '../setup/app';
import { executeRequest } from '../helpers';

describe('aggregates', () => {
  beforeAll(async () => {
    await setupTestApp();
  });
  afterAll(async () => {
    await shutdownTestApp();
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
});
