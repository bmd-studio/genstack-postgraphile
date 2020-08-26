const _ = require('lodash');
const path = require('upath');
const express = require('express');
const { createServer } = require('http');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bearerToken = require('express-bearer-token');

const environment = require('@bmd-studio/genstack-environment').default;
const logger = require('@bmd-studio/genstack-logger').default;

const {
  COOKIE_PARSER_SECRET,
  POSTGRAPHILE_ACCESS_TOKEN_KEY,
  JWT_HEADER_PREFIX,
  GRAPHQL_CORS_DOMAINS,
} = environment.env;
let defaultApp = null;
let defaultServer = null;
const routerCache = {};

module.exports = {

  /**
   * Initialize the default express instances and create a router to start with
   */
  install ({ httpPath = '' } = {}) {
    const app = this.installApp();
    const server = this.installServer();
    const router = this.installRouter({
      routeBasePath: path.join('/', httpPath)
    });

    return {
      app,
      server,
      router,
    };
  },

  /**
   * Create a new express app instance
   * @param {*} useDefault 
   */
  installApp ({ useDefault = true } = {}) {

    // check if we should use the default instance
    if (useDefault && !_.isEmpty(defaultApp)) {
      return defaultApp;
    }

    // create new express instance
    logger.info.express(`Creating new express instance...`);
    const app = express();

    this.installParsers({ app });
    this.installSecurity({ app });
    this.installLogging({ app });

    // check if this app should be stored as the default
    if (_.isEmpty(defaultApp)) {
      defaultApp = app;
    }

    return app;
  },

  /**
   * Create an express server instance compatible with serverless infrastructure
   * @param {*} app 
   * @param {*} useDefault 
   */  
  installServer ({ app = defaultApp, useDefault = true } = {}) {

    // check if we should use the default instance
    if (useDefault && !_.isEmpty(defaultServer)) {
      return defaultServer;
    }
  
    // create new server instance
    logger.info.express(`Creating new express server instance...`);
    const server = createServer(app);

    // check if this app should be stored as the default
    if (_.isEmpty(defaultServer)) {
      defaultServer = server;
    }
  
    return server;
  },

  /**
   * Create an express router instance to manage seperate middleware from a specific handler
   * @param {*} baseRoute 
   */
  installRouter ({ app = defaultApp, routerName = 'default', routeBasePath = '/' } = {}) {
  
    // check if the router already exists
    if (_.has(routerCache, routerName)) {
      return _.get(routerCache, routerName);
    }

    // debug
    logger.info.express(`Creating a new router for handler ${routerName} on route ${routeBasePath}`);
    const router = express.Router();

    // use the created router in the express app
    app.use(routeBasePath, router);
  
    // register in cache
    routerCache[routerName] = router;
    return router;
  },

  /**
   * 
   * @param {*} param0 
   */
  installLogging ({ app = defaultApp } = {}) {

    // guard: initialize debugging only when express group is enabled
    if (!logger.isEnabled('express')) {
      return;
    }
  
    logger.info.express(`Installing debugging middleware...`);
  
    // initialize the morgan logger
    app.use(morgan('tiny'));
  
    logger.info.express(`Debugging middleware is installed!`);
  },

  /**
   * Add request parsers to support body, cookie and bearer tokens
   * @param {*} param0 
   */
  installParsers ({ app = defaultApp } = {}) {
    logger.info.express(`Installing parsers middleware...`);
    
    // initialize body parser
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    
    // initialize cookie parser
    app.use(cookieParser(COOKIE_PARSER_SECRET));
    
    // initialize token parser
    app.use(bearerToken({
      bodyKey: POSTGRAPHILE_ACCESS_TOKEN_KEY,
      queryKey: POSTGRAPHILE_ACCESS_TOKEN_KEY,
      headerKey: JWT_HEADER_PREFIX,
      reqKey: POSTGRAPHILE_ACCESS_TOKEN_KEY
    }));
  
    logger.info.express(`Parsers middleware is installed!`);
  },

  /**
   * Allow CORS requests and add helmet for default security presets
   * @param {*} param0 
   */
  installSecurity ({ app = defaultApp } = {}) {

    logger.info.express(`Installing security middleware...`);
  
    app.use(cors({
      origin: GRAPHQL_CORS_DOMAINS,
      credentials: true,
    }));
  
    // https://expressjs.com/en/advanced/best-practice-security.html#use-helmet
    app.use(helmet());
  
    logger.info.express(`Security middleware is installed!`);
  },
};