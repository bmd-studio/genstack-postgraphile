import dotenvParseVariables from 'dotenv-parse-variables';

import environment from '@bmd-studio/genstack-environment';

export default {
  isProduction: environment.isProduction,
  isDevelopment: environment.isDevelopment,

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  get env() {
    return {
      APP_PREFIX: 'project', 
      DEBUG: 'postgraphile:error,postgraphile:info',
      DEBUG_NAMESPACE: 'postgraphile',

      DEFAULT_HTTP_PORT: 4000,

      POSTGRAPHILE_MQTT_THROTTLE_TIME: 50,
      MQTT_SUBSCRIPTIONS_ENABLED: true,
      MQTT_HOST_NAME: 'vernemq',
      MQTT_PORT: 1883,
      MQTT_DEFAULT_QOS: 1,
      MQTT_DATABASE_CHANNEL_PREFIX: 'pg',
      MQTT_ADMIN_USERNAME: 'admin',
      MQTT_ADMIN_SECRET: 'password',

      ACCESS_TOKEN_KEY: 'accessToken',

      COOKIE_PARSER_SECRET: 'unknown',

      GRAPHQL_DATABASE_SCHEMA: 'app_public',
      GRAPHQL_PATH: '/graphql',
      GRAPHIQL_ENABLED: false,
      GRAPHIQL_PATH: '/graphiql',
      GRAPHQL_BODY_SIZE_LIMIT: '200kB',
      GRAPHQL_CORS_DOMAINS: 'http://localhost:3000',

      AUTH_AUTO_ADMIN_FALLBACK: false,

      CUSTOM_HTTP_HEADER_PREFIX: 'x-bmd-',

      POSTGRES_HOST_NAME: 'postgresql',
      POSTGRES_PORT: '5432',
      POSTGRES_DATABASE_NAME: 'project',
      POSTGRES_SUPER_USER_ROLE_NAME: 'postgres',
      POSTGRES_SUPER_USER_SECRET: 'password',
      POSTGRES_ADMIN_ROLE_NAME: 'admin',
      POSTGRES_ADMIN_SECRET: 'password',
      POSTGRES_IDENTITY_ROLE_NAME: 'identity',
      POSTGRES_IDENTITY_SECRET: 'password',
      POSTGRES_ANONYMOUS_ROLE_NAME: 'anonymous',
      POSTGRES_ANONYMOUS_SECRET: 'password',

      POSTGRES_IDENTITY_TABLE_NAME: 'identities',
      POSTGRES_IDENTITY_IDENTIFICATION_COLUMN_NAME: 'username',
      POSTGRES_IDENTITY_SECRET_COLUMN_NAME: 'password',
      POSTGRES_IDENTITY_ROLES_COLUMN_NAME: 'roles',
      POSTGRES_HIDDEN_COLUMN_NAMES: 'password,secret',

      DATABASE_ID_COLUMN_NAME: 'id',

      JWT_ROLE_FIELD: 'identity_role',
      JWT_SECRET: 'unknown',

      ...environment.env,
    };
  }
};