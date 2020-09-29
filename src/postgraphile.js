const _ = require('lodash');
const url = require('url');
const pg = require('pg');
const { 
  postgraphile,
  makePluginHook,
} = require('postgraphile');

const express = require('./express');
const ConnectionFilterPlugin = require('postgraphile-plugin-connection-filter');
const LiveQueriesPlugin = require("@graphile/subscriptions-lds").default;
const PostGraphileNestedMutations = require('postgraphile-plugin-nested-mutations');
const { PgMutationUpsertPlugin } = require("@fullstackio/postgraphile-upsert-plugin");
const PgManyToManyPlugin = require("@graphile-contrib/pg-many-to-many");
const PgOrderByRelatedPlugin = require("@graphile-contrib/pg-order-by-related");
const PgSimplifyInflectorPlugin = require("@graphile-contrib/pg-simplify-inflector");
const GraphileColumnPrivilegesMutations = require('graphile-column-privileges-mutations');

const environment = require('@bmd-studio/genstack-environment').default;
const logger = require('@bmd-studio/genstack-logger').default;
const hooks = require('@bmd-studio/genstack-hooks').default;

const authentication = require('./authentication');

const MqttSubscriptionPlugin = require('./mqttSubscriptionPlugin');
const ShortcutPlugin = require('./shortcutPlugin');
const RemoveSecretsPlugin = require('./removeSecretsPlugin');
const AggregatesPlugin = require('./pg-aggregates').default;

const {
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
} = environment.env;

logger.info.postgraphile(`Preparing PostGraphile middleware...`);

const getSuperUserUrl = () => {
  return `postgres://${POSTGRES_SUPER_USER_ROLE_NAME}:${POSTGRES_SUPER_USER_SECRET}@${POSTGRES_HOST_NAME}:${POSTGRES_PORT}/${POSTGRES_DATABASE_NAME}`;
};

const pgOptions = {
  host: POSTGRES_HOST_NAME,
  port: POSTGRES_PORT,
  user: authentication.prefixRoleName(POSTGRES_ADMIN_ROLE_NAME),
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
    PgSimplifyInflectorPlugin,
    
    AggregatesPlugin,
    MqttSubscriptionPlugin,
    RemoveSecretsPlugin,

    // GraphileColumnPrivilegesMutations.PgMutationCreatePlugin,
    // GraphileColumnPrivilegesMutations.PgMutationUpdateDeletePlugin,
    //ShortcutPlugin,
  ],

  // graphileBuildOptions: {
  //   // disable the default mutations
  //   pgDisableDefaultMutations: true
  // },

  // live queries
  live: true,
  ownerConnectionString: getSuperUserUrl(),

  // subscriptions
  subscriptions: true,
  simpleSubscriptions: true,
  websocketMiddlewares: [
    (req, res, next) => {

      // parse the URL parameters to the query parameters
      // this allows us to support authentication via the query parameters
      const urlProperties = url.parse(req.url, true);
      req.query = urlProperties.query;
      next();
    },
  ],

  // request
  bodySizeLimit: GRAPHQL_BODY_SIZE_LIMIT,
  enableQueryBatching: true,
  
  // postgres settings
  pgSettings: async (req) => {
    const identity = await authentication.getIdentityByRequest(req);
    const identityId = _.get(identity, 'identity_id');
    const identityRole = _.get(identity, 'identity_role', POSTGRES_IDENTITY_ROLE_NAME);

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

    logger.verbose.postgraphile(`The following PG settings were determined to handle the request:`);
    logger.verbose.postgraphile(pgSettings);

    return pgSettings;
  },

  // resolver settings
  additionalGraphQLContextFromRequest: (req, res) => {
    return {};
  },

}));

logger.info.postgraphile(`PostGraphile middleware is ready to use.`);

// handle GraphQL requests and pass them on to postgraphile
module.exports = ({ app, server, router }) => {

  // add as middleware
  // NOTE: postgraphile is mounted directly on the app as we are sure that
  // the correct paths (e.g. /graphql) are caught by this middleware
  logger.info.middleware(`Installing postgraphile middleware...`);
  app.use(postgraphileMiddleware);
  logger.info.middleware(`Postgraphile middleware is installed!`);
};
