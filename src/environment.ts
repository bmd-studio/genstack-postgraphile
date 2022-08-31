import dotenvParseVariables from 'dotenv-parse-variables';
import { EnvType } from './types';

export enum TestMode {
  Default = 'default',
  Container = 'container',
}

export const isTestingContainer = () => {
  const { TEST_MODE } = environment.env;

  return TEST_MODE === TestMode.Container;
};

const isEnvironment = (type: EnvType) => {
  const {
    NODE_ENV = 'production',
  } = process.env;

  return NODE_ENV === type;
};

const parseEnv = (envUnparsed: any) => {
  return dotenvParseVariables(envUnparsed, {
    assignToProcessEnv: false,
    overrideProcessEnv: false,
  });
};

const environment = {
  isProduction: (): boolean => {
    return isEnvironment('production');
  },
  isDevelopment: (): boolean => {
    return isEnvironment('development');
  },

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  get env() {
    const parsedProcessEnv = parseEnv(process.env);

    return {
      APP_PREFIX: 'project',
      DEBUG: 'pg-graphql:error,pg-graphql:info',
      DEBUG_NAMESPACE: 'pg-graphql',
      NODE_ENV: 'development',
      TEST_MODE: TestMode.Default,

      DEFAULT_HTTP_PORT: 4000,

      POSTGRAPHILE_MQTT_THROTTLE_TIME: 50,
      GRAPHQL_MQTT_SUBSCRIPTIONS_ENABLED: false,
      MQTT_HOST_NAME: 'vernemq',
      MQTT_PORT: 1883,
      MQTT_DEFAULT_QOS: 1,
      MQTT_DATABASE_CHANNEL_PREFIX: 'pg',
      MQTT_ADMIN_USERNAME: 'admin',
      MQTT_ADMIN_SECRET: 'password',

      GRAPHQL_SIMPLIFY_INFLECTOR_ENABLED: true,

      GRAPHQL_SUBSCRIPTIONS_ENABLED: true,

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
      POSTGRES_PORT: 5432,
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

      ...parsedProcessEnv,
    };
  },
};

export default environment;
