import _ from 'lodash';
import path from 'upath';
import express, { Application, Router } from 'express';
import { createServer } from 'http';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

import environment from './environment';
import logger from './logger';
import { ServerContext } from './types';

const {
  COOKIE_PARSER_SECRET,
  GRAPHQL_CORS_DOMAINS,
  GRAPHQL_BODY_SIZE_LIMIT,
} = environment.env;

const routerCache = {};

export interface DefaultMiddlewareOptions {
  app: Application;
}

export interface RouterMiddleWareOptions extends DefaultMiddlewareOptions {
  routerName?: string;
  routeBasePath?: string;
}

/**
 * Initialize the default express instances and create a router to start with
 */
export const install = ({ httpPath = '' } = {}): ServerContext => {
  const app = installApp();
  const server = installServer({ app });
  const router = installRouter({
    app,
    routeBasePath: path.join('/', httpPath)
  });

  return {
    app,
    server,
    router,
  };
};

/**
 * Create a new express app instance
 */
export const installApp = () => {

  // create new express instance
  logger.info(`Creating new express instance...`);
  const app = express();

  installParsers({ app });
  installSecurity({ app });
  installLogging({ app });

  return app;
};

/**
 * Create an express server instance compatible with serverless infrastructure
 */  
export const installServer = ({ app }: DefaultMiddlewareOptions) => {

  // create new server instance
  logger.info(`Creating new express server instance...`);
  const server = createServer(app);

  return server;
};

/**
 * Create an express router instance to manage seperate middleware from a specific handler
 */
export const installRouter = ({ app, routerName = 'default', routeBasePath = '/' }: RouterMiddleWareOptions): Router => {

  // check if the router already exists
  if (_.has(routerCache, routerName)) {
    return _.get(routerCache, routerName);
  }

  // debug
  logger.info(`Creating a new router for handler ${routerName} on route ${routeBasePath}`);
  const router = express.Router();

  // use the created router in the express app
  app.use(routeBasePath, router);

  // register in cache
  routerCache[routerName] = router;
  return router;
};

/**
 * 
 * @param {*} param0 
 */
export const installLogging = ({ app }: DefaultMiddlewareOptions) => {
  logger.info(`Installing debugging middleware...`);

  // initialize the morgan logger
  app.use(morgan('tiny'));

  logger.info(`Debugging middleware is installed.`);
};

/**
 * Add request parsers to support body, cookie and bearer tokens
 * @param {*} param0 
 */
export const installParsers = ({ app }: DefaultMiddlewareOptions) => {
  logger.info(`Installing parsers middleware...`);

  // initialize body parser
  app.use(bodyParser.json({
    limit: GRAPHQL_BODY_SIZE_LIMIT,
  }));
  app.use(bodyParser.urlencoded({ extended: false }));
  
  // initialize cookie parser
  app.use(cookieParser(COOKIE_PARSER_SECRET));

  logger.info(`Parsers middleware is installed.`);
};

/**
 * Allow CORS requests and add helmet for default security presets
 * @param {*} param0 
 */
export const installSecurity = ({ app }: DefaultMiddlewareOptions) => {

  logger.info(`Installing security middleware...`);

  app.use(cors({
    origin: GRAPHQL_CORS_DOMAINS,
    credentials: true,
  }));

  // https://expressjs.com/en/advanced/best-practice-security.html#use-helmet
  app.use(helmet());

  logger.info(`Security middleware is installed!`);
};