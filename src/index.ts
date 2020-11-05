import logger from './logger';
import environment from './environment';
import { install as installExpress } from './server';
import { install as installPostgraphile } from './graphql';

const {
  DEFAULT_HTTP_PORT,
  GRAPHQL_PATH,
} = environment.env;

// install express
const { app, server, router } = installExpress({ 
  httpPath: GRAPHQL_PATH 
});

// initialize the GraphQL handler
installPostgraphile({ 
  app, 
  server, 
  router, 
});

server.listen(DEFAULT_HTTP_PORT, () => {
  logger.info(`🚀 Server running and listening on port ${DEFAULT_HTTP_PORT}...`);
});