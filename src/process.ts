import { Server } from 'net';

import logger from './logger';
import environment from './environment';
import { install as installExpress } from './server';
import { install as installPostgraphile } from './graphql';
import { ProcessOptions } from './types';

const {
  DEFAULT_HTTP_PORT,
  GRAPHQL_PATH,
  NODE_ENV,
} = environment.env;

let cachedServer: Server | undefined;

// reboot this service
export const reboot = (): void => {
  logger.info(`Rebooting service...`);

  // don't exit when in test environment,
  if (NODE_ENV !== 'test') {
    process.exit(1);
  }
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const startProcess = async (options?: ProcessOptions): Promise<void> => {
  logger.info(`Starting process...`);
  const { serverOptions } = options ?? {};
  const { port = DEFAULT_HTTP_PORT, path = GRAPHQL_PATH } = serverOptions ?? {};

  // install express
  const { app, server, router } = installExpress({
    httpPath: path,
  });

  // cache it for the shutdown process
  cachedServer = server;

  // initialize the GraphQL handler
  installPostgraphile({
    app,
    server,
    router,
    processOptions: options,
  });

  logger.info(`Server starting on port ${port}...`);

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      logger.info(`🚀 Server running and listening on port ${port}...`);
      resolve();
    });
  });
};

export const stopProcess = async (): Promise<void> => {
  logger.info(`Stopping process...`);
  cachedServer?.close();
};
