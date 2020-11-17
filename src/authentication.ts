import _ from 'lodash';
import jwt from 'jsonwebtoken';

import hooks from '@bmd-studio/genstack-hooks';

import environment from './environment';
import logger from './logger';
import { AccessToken, JwtPayload } from './types';

const {
  APP_PREFIX,
  POSTGRES_ANONYMOUS_ROLE_NAME,
  POSTGRES_ADMIN_ROLE_NAME,
  CUSTOM_HTTP_HEADER_PREFIX,
  ACCESS_TOKEN_KEY,
  JWT_SECRET,
  JWT_ROLE_FIELD,
  AUTH_AUTO_ADMIN_FALLBACK,
} = environment.env;

const authentication = hooks.wrapResourceWithHooks('authentication', { 

  /**
   * Get the JWT token from a request where it can be retrieved:
   * (1) directly in the query parameters
   * (2) via the identification and secret provided in the query parameters
   * (3) in the authorization headers
   * @param {*} event 
   * @param {*} req 
   */
  getAccessTokenByRequest (req: Request): AccessToken {

    // debug
    logger.verbose(`Getting the JWT token from the request...`);
    logger.verbose(`Query:`, _.get(req, `query`));
    logger.verbose(`Headers:`, _.get(req, `headers`));
    logger.verbose(`Session:`, _.get(req, `session`));
    logger.verbose(`Body:`, _.get(req, `body`));
    logger.verbose(`Connection parameters:`, _.get(req, `connectionParams`));

    const authorizationHeaderPieces = _.split(_.get(req, `headers.authorization`), ' ');
    const bearerAccessToken = _.get(authorizationHeaderPieces, 1);

    // get the token from either: the query parameters, the post, the headers, the current session or GraphQL query variables
    // NOTE: headers are fetched in lowercase as they are converted to lowercase when parsing the request
    const accessToken = bearerAccessToken
      || _.get(req, `query.${ACCESS_TOKEN_KEY}`)
      || _.get(req, `headers.${CUSTOM_HTTP_HEADER_PREFIX}${ACCESS_TOKEN_KEY}`.toLowerCase()) 
      || _.get(req, `session.${ACCESS_TOKEN_KEY}`) 
      || _.get(req, `body.${ACCESS_TOKEN_KEY}`)
      || _.get(req, `body.variables.${ACCESS_TOKEN_KEY}`)
      || _.get(req, `connectionParams.${ACCESS_TOKEN_KEY}`);

    logger.verbose(`A JWT token is ${_.isEmpty(accessToken) ? 'NOT' : ''} found directly in the request.`);

    return accessToken;
  },

  /**
   * Verify an auth token and return the payload encrypted in it
   * 
   * @param {*} accessToken 
   */
  async decodeAccessToken (accessToken: string): Promise<JwtPayload> {
    let payload = {};

    // guard: check if the token is empty
    if (_.isEmpty(accessToken)) {
      return payload;
    }

    // perform verification
    logger.verbose(`A JWT token is being verified...`);

    // perform verification
    try {
      payload = await jwt.verify(accessToken, JWT_SECRET);
      logger.verbose(`The JWT token verification succeeded.`);
    } catch (exception) {
      logger.verbose(`The JWT token verification failed.`);
    }

    return payload;
  },

  /**
   * Get the current role name by the current request and possible JWT token
   * By default it will fallback to the anonymous identity
   * @param {*} req 
   */
  async getIdentityByRequest (req: Request): Promise<JwtPayload> {
    let accessToken = '';
    let jwtPayload = {};

    // attempt to authenticate via the request
    try {
      accessToken = await this.getAccessTokenByRequest(req);

      if (!_.isEmpty(accessToken)) {
        jwtPayload = await this.decodeAccessToken(accessToken);
      }
    } catch (error) {
      logger.error(`An error occurred when getting the JWT token from the request:`);
      logger.error(error);
    }

    // guard: check if a default identity is required
    if (_.isEmpty(jwtPayload)) {
      jwtPayload = this.getAnonymousJwtPayload(req);
    }

    logger.verbose(`The following identity is deduced from the request:`);
    logger.verbose(jwtPayload);

    return jwtPayload;
  },

  getAnonymousJwtPayload (req: Request): JwtPayload {
    let defaultIdentityRole = POSTGRES_ANONYMOUS_ROLE_NAME;

    // check if admin credentials are requested in development environments
    if (this.isAdminByRequest(req)) {
      defaultIdentityRole = POSTGRES_ADMIN_ROLE_NAME;
    }

    const jwtPayload = {
      [JWT_ROLE_FIELD]: defaultIdentityRole,
    };

    return jwtPayload;
  },

  isAdminByRequest (req: Request): boolean {
 
    // NOTE: headers are fetched in lowercase as they are converted to lowercase when parsing the request
    const loginAsAdmin = _.get(req, `query.admin`, _.get(req, `headers.${CUSTOM_HTTP_HEADER_PREFIX}admin`.toLowerCase()));

    // only allow auto fallback to admin connection when not in production
    if (environment.isProduction()) {
      return false;
    }

    // check if the fallback is requested by the query parameter or via the environment variables
    if (_.includes([true, 'true', 1, '1', ''], loginAsAdmin) || AUTH_AUTO_ADMIN_FALLBACK) {
      return true;
    }

    return false;
  },

  /**
   * Prefix a role name with the project prefix
   * @param {*} roleName 
   */
  prefixRoleName (roleName: string): string {
    return `${APP_PREFIX}_${roleName}`;
  },
});

export default authentication;