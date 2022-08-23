import { request } from 'graphql-request';
import { RequestDocument, Variables } from 'graphql-request/dist/types';

import environment from '../environment';

export function executeRequest(document: RequestDocument, variables?: Variables) {
  const {
    DEFAULT_HTTP_PORT
  } = environment.env;
  const url = `http://localhost:${DEFAULT_HTTP_PORT}/graphql?admin`;

  return request(url, document, variables);
}
