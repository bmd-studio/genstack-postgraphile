import logger from './logger';
import environment from './environment';
import { install as installExpress } from './server';
import { install as installPostgraphile } from './graphql';

const {
  DEFAULT_HTTP_PORT,
  GRAPHQL_PATH,
  NODE_ENV,
} = environment.env;

// install express
const { app, server, router } = installExpress({ 
  httpPath: GRAPHQL_PATH 
});

// reboot this service
export const reboot = (): void => {
  logger.info(`Rebooting service...`);

  // don't exit when in test environment,
  if (NODE_ENV !== 'test') {
    process.exit(1);
  }
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const startProcess = async (): Promise<void> => {

  // initialize the GraphQL handler
  installPostgraphile({ 
    app, 
    server, 
    router, 
  });

  logger.info(`Server starting on port ${DEFAULT_HTTP_PORT}...`);
  
  return new Promise((resolve, reject) => {
    server.listen(DEFAULT_HTTP_PORT, () => {
      logger.info(`🚀 Server running and listening on port ${DEFAULT_HTTP_PORT}...`);
      resolve();
    });
  });
};

export const stopProcess = async (): Promise<void> => {
  server.close();
};