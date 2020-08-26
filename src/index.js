const environment = require('@bmd-studio/genstack-environment').default;
const logger = require('@bmd-studio/genstack-logger').default;

const express = require('./express');
const installPostgraphile = require('./postgraphile');

const {
  DEFAULT_HTTP_PORT,
  GRAPHQL_PATH,
} = environment.env;

// install express
const { app, server, router } = express.install({ 
  httpPath: GRAPHQL_PATH 
});

// initialize the GraphQL handler
installPostgraphile({ 
  app, 
  server, 
  router, 
});

server.listen(DEFAULT_HTTP_PORT, () => {
  logger.info.handlers(`🚀 Server running and listening on port ${DEFAULT_HTTP_PORT}...`);
});