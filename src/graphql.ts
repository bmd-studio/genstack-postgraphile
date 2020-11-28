import _ from 'lodash';
import url from 'url';
import pg from 'pg';
import { postgraphile } from 'postgraphile';
import { Request, Response } from 'express';

import ConnectionFilterPlugin from 'postgraphile-plugin-connection-filter';
import LiveQueriesPlugin from '@graphile/subscriptions-lds';
import PostGraphileNestedMutations from 'postgraphile-plugin-nested-mutations';
import { PgMutationUpsertPlugin } from "@fullstackio/postgraphile-upsert-plugin";
import PgManyToManyPlugin from '@graphile-contrib/pg-many-to-many';
import PgOrderByRelatedPlugin from '@graphile-contrib/pg-order-by-related';
import PgSimplifyInflectorPlugin from "@graphile-contrib/pg-simplify-inflector";

import hooks from '@bmd-studio/genstack-hooks';

import logger from './logger';
import environment from './environment';
import authentication from './authentication';

import MqttSubscriptionPlugin from './plugins/MqttSubscriptionPlugin';
import RemoveSecretsPlugin from './plugins/RemoveSecretsPlugin';
import AggregatesPlugin from './plugins/aggregates';
import { ServerContext } from './types';

const {
  NODE_ENV, 
  POSTGRES_HOST_NAME,
  POSTGRES_PORT,
  POSTGRES_ADMIN_ROLE_NAME,
  POSTGRES_ADMIN_SECRET,
  POSTGRES_DATABASE_NAME,

  POSTGRES_SUPER_USER_ROLE_NAME,
  POSTGRES_SUPER_USER_SECRET,

  POSTGRES_IDENTITY_ROLE_NAME,

  GRAPHQL_DATABASE_SCHEMA,
  GRAPHQL_PATH,
  GRAPHIQL_ENABLED,
  GRAPHIQL_PATH,
  GRAPHQL_BODY_SIZE_LIMIT,

  GRAPHQL_SIMPLIFY_INFLECTOR_ENABLED,
  GRAPHQL_MQTT_SUBSCRIPTIONS_ENABLED,
} = environment.env;

export const install = ({ app, server, router }: ServerContext) => {
  const adminPostgresUser = authentication.prefixRoleName(POSTGRES_ADMIN_ROLE_NAME);
  const isTestEnvironment = (NODE_ENV === 'test');
  
  logger.info(`Preparing PostGraphile middleware for Postgres ${POSTGRES_HOST_NAME}:${POSTGRES_PORT} with user ${adminPostgresUser} on schema ${GRAPHQL_DATABASE_SCHEMA}...`);
  
  const getSuperUserUrl = () => {
    return `postgres://${POSTGRES_SUPER_USER_ROLE_NAME}:${POSTGRES_SUPER_USER_SECRET}@${POSTGRES_HOST_NAME}:${POSTGRES_PORT}/${POSTGRES_DATABASE_NAME}`;
  };
  
  const pgOptions: pg.ConnectionConfig = {
    host: POSTGRES_HOST_NAME,
    port: POSTGRES_PORT,
    user: adminPostgresUser,
    password: POSTGRES_ADMIN_SECRET,
    database: POSTGRES_DATABASE_NAME,
  };
  
  const pgPool = new pg.Pool(pgOptions);
  
  // create postgraphile middleware
  const postgraphileMiddleware = postgraphile(pgPool, GRAPHQL_DATABASE_SCHEMA, hooks.wrapResourceWithHooks('postgraphileOptions', {
  
    // debugging
    // https://github.com/brianc/node-postgres/blob/7de137f9f88611b8fcae5539aa90b6037133f1f1/lib/connection.js#L565-L580
    extendedErrors: !environment.isProduction() ? ['hint', 'detail', 'errcode' ] : ['errcode'],
    showErrorStack: !environment.isProduction(),
    disableQueryLog: environment.isProduction(),
  
    // process
    retryOnInitFail: isTestEnvironment,

    // routes
    graphqlRoute: GRAPHQL_PATH,
    graphiqlRoute: GRAPHIQL_PATH,
  
    // postgres
    dynamicJson: true,
    ignoreRBAC: false,
    ignoreIndexes: false,
    setofFunctionsContainNulls: false,
    allowExplain: !environment.isProduction(),
  
    // graphql
    enableQueryBatching: true,
    legacyRelations: 'omit',
  
    // graphiql
    graphiql: GRAPHIQL_ENABLED,
    enhanceGraphiql: !environment.isProduction(),
  
    // plugins
    appendPlugins: [
      ConnectionFilterPlugin,
      PostGraphileNestedMutations,
      PgMutationUpsertPlugin,
      LiveQueriesPlugin,
      PgManyToManyPlugin,
      PgOrderByRelatedPlugin,
      
      AggregatesPlugin,
      RemoveSecretsPlugin,
  
      GRAPHQL_SIMPLIFY_INFLECTOR_ENABLED ? PgSimplifyInflectorPlugin : () => {},
      GRAPHQL_MQTT_SUBSCRIPTIONS_ENABLED ? MqttSubscriptionPlugin : () => {},
    ],
  
    // live queries
    live: true,
    ownerConnectionString: getSuperUserUrl(),
  
    // subscriptions
    subscriptions: true,
    simpleSubscriptions: true,
    websocketMiddlewares: [
      (req: Request, res: Response, next: Function) => {
  
        // parse the URL parameters to the query parameters
        // this allows us to support authentication via the query parameters
        const urlProperties = url.parse(req.url, true);
        req.query = urlProperties.query;
        next();
      },
    ],
  
    // request
    bodySizeLimit: GRAPHQL_BODY_SIZE_LIMIT,
    
    // postgres settings
    pgSettings: async (req: Request) => {
      const identity = await authentication.getIdentityByRequest(req);
      const identityId = identity?.identity_id;
      const identityRole = identity?.identity_role || POSTGRES_IDENTITY_ROLE_NAME;
  
      // TODO: see if there is a way to improve performance of setting these in the DB
      // from quick tests it shows a performance drop of 30% to 40% in req/s 
      // this is mainly caused by Postgraphile creating a new pgClient instead of using the cache
      // when there are no settings. 
      // SOURCE: https://github.com/graphile/postgraphile/blob/cd23d26743d73d4d54b93a15dc89eb1c90f09a4b/src/postgraphile/withPostGraphileContext.ts#L146
      const pgSettings = {
        
        // required to switch roles in Postgres
        'role': authentication.prefixRoleName(identityRole),
  
        // required for row-level security checks and GraphQL
        'jwt.claims.identity_id': identityId,
        'jwt.claims.identity_role': identityRole,
      };
  
      logger.verbose(`The following PG settings were determined to handle the request:`);
      logger.verbose(pgSettings);
  
      return pgSettings;
    },
  
    // resolver settings
    additionalGraphQLContextFromRequest: (req: Request, res: Response) => {
      return {};
    },
  }));
  
  logger.info(`Installing postgraphile middleware...`);
  app.use(postgraphileMiddleware);
  logger.info(`Postgraphile middleware is installed!`);
};
