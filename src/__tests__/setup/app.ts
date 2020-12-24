import _ from 'lodash';
import pg, { Pool } from 'pg';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import getPort from 'get-port';

import environment from '../../environment';

const POSTGRES_INTERNAL_PORT = 5432;
const MQTT_INTERNAL_PORT = 1883;

const POSTGRES_DOCKER_IMAGE = 'postgres';
const POSTGRES_DOCKER_TAG = '13.0-alpine';
const MQTT_DOCKER_IMAGE = 'eclipse-mosquitto';
const MQTT_DOCKER_TAG = '1.6.9';

const APP_PREFIX = 'test';

const POSTGRES_HOST_NAME = '0.0.0.0';
const POSTGRES_DATABASE_NAME = 'test';

const POSTGRES_SUPER_USER_ROLE_NAME = 'postgres';
const POSTGRES_SUPER_USER_SECRET = 'password';
const POSTGRES_ADMIN_ROLE_NAME = 'admin';
const POSTGRES_ADMIN_SECRET = 'password';
const POSTGRES_IDENTITY_ROLE_NAME = 'identity';
const POSTGRES_IDENTITY_SECRET = 'password';
const POSTGRES_ANONYMOUS_ROLE_NAME = 'anonymous';
const POSTGRES_ANONYMOUS_SECRET = 'password';

const POSTGRES_DEFAULT_SCHEMA_NAME = 'public';
const POSTGRES_PUBLIC_SCHEMA_NAME = 'test_public';
const POSTGRES_PRIVATE_SCHEMA_NAME = 'test_private';
const POSTGRES_HIDDEN_SCHEMA_NAME = 'test_hidden';

const MQTT_HOST_NAME = '0.0.0.0';

export const PROJECT_TABLE_NAME = 'projects';

// The project amount determines the amount of projects seeded in the database,
// but also the amount of database events trigger AT ONCE (the testing query updates all queries).
// This provides a good stress tester for this service to see how fast it can run.
// Note that if you want to stress test with more you likely need to increase the test timeout in your jest config.
export const PROJECT_AMOUNT = parseInt(process?.env?.PROJECT_AMOUNT ?? '10000');

let pgContainer: StartedTestContainer; 
let mqttContainer: StartedTestContainer; 

const setupTestContainers = async(): Promise<void> => {
  pgContainer = await new GenericContainer(POSTGRES_DOCKER_IMAGE, POSTGRES_DOCKER_TAG)
    .withExposedPorts(POSTGRES_INTERNAL_PORT)
    .withEnv('POSTGRES_USER', POSTGRES_SUPER_USER_ROLE_NAME)
    .withEnv('POSTGRES_PASSWORD', POSTGRES_SUPER_USER_SECRET)
    .withEnv('POSTGRES_DB', POSTGRES_DATABASE_NAME)
    .start();

  mqttContainer = await new GenericContainer(MQTT_DOCKER_IMAGE, MQTT_DOCKER_TAG)
    .withExposedPorts(MQTT_INTERNAL_PORT)
    .start(); 
};

const shutdownTestContainers = async(): Promise<void> => {
  await pgContainer.stop();
  await mqttContainer.stop();
};

const setupEnv = async (): Promise<void> => {
  _.assignIn(process.env, {
    NODE_ENV: 'development',
    GS_ENV: 'development',
    APP_PREFIX,    
    DEFAULT_HTTP_PORT: await getPort(),

    POSTGRES_HOST_NAME,
    POSTGRES_PORT: pgContainer.getMappedPort(POSTGRES_INTERNAL_PORT).toString(),
    POSTGRES_DATABASE_NAME,
    POSTGRES_SUPER_USER_ROLE_NAME,
    POSTGRES_SUPER_USER_SECRET,
    POSTGRES_ADMIN_ROLE_NAME,
    POSTGRES_ADMIN_SECRET,
    POSTGRES_IDENTITY_ROLE_NAME,
    POSTGRES_IDENTITY_SECRET,
    POSTGRES_ANONYMOUS_ROLE_NAME,
    POSTGRES_ANONYMOUS_SECRET,

    POSTGRES_DEFAULT_SCHEMA_NAME,
    POSTGRES_PUBLIC_SCHEMA_NAME,
    POSTGRES_PRIVATE_SCHEMA_NAME,
    POSTGRES_HIDDEN_SCHEMA_NAME,
    GRAPHQL_DATABASE_SCHEMA: POSTGRES_PUBLIC_SCHEMA_NAME,

    MQTT_HOST_NAME,
    MQTT_PORT: mqttContainer.getMappedPort(MQTT_INTERNAL_PORT).toString(),
    GRAPHQL_MQTT_SUBSCRIPTIONS_ENABLED: true,
  });
};

const getPgPool = async(): Promise<pg.Pool> => {
  const { POSTGRES_PORT } = environment.env;
  const pool = new Pool({
    host: POSTGRES_HOST_NAME,
    port: POSTGRES_PORT,
    user: POSTGRES_SUPER_USER_ROLE_NAME,
    password: POSTGRES_ADMIN_SECRET,
    database: POSTGRES_DATABASE_NAME,
  });

  return pool;
};

const prefixRoleName = (roleName: string): string => {
  return `${APP_PREFIX}_${roleName}`;
};

const setupDatabase = async (): Promise<void> => {
  const pgPool = await getPgPool();
  const adminRoleName = prefixRoleName(POSTGRES_ADMIN_ROLE_NAME);
  const identityRoleName = prefixRoleName(POSTGRES_IDENTITY_ROLE_NAME);
  const anonymousRoleName = prefixRoleName(POSTGRES_ANONYMOUS_ROLE_NAME);

  await pgPool.query(`
    CREATE EXTENSION "uuid-ossp";

    CREATE SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}";
    CREATE SCHEMA "${POSTGRES_PRIVATE_SCHEMA_NAME}";
    CREATE SCHEMA "${POSTGRES_HIDDEN_SCHEMA_NAME}";

    CREATE TABLE "${POSTGRES_PUBLIC_SCHEMA_NAME}"."${PROJECT_TABLE_NAME}" (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text
    );

    CREATE ROLE "${adminRoleName}" WITH LOGIN PASSWORD '${POSTGRES_ADMIN_SECRET}';  
    CREATE ROLE "${identityRoleName}" WITH LOGIN PASSWORD '${POSTGRES_IDENTITY_SECRET}';  
    CREATE ROLE "${anonymousRoleName}" WITH LOGIN PASSWORD '${POSTGRES_ANONYMOUS_SECRET}';  

    GRANT CONNECT ON DATABASE ${POSTGRES_DATABASE_NAME} TO "${adminRoleName}";
    GRANT CONNECT ON DATABASE ${POSTGRES_DATABASE_NAME} TO "${identityRoleName}";
    GRANT CONNECT ON DATABASE ${POSTGRES_DATABASE_NAME} TO "${anonymousRoleName}";

    GRANT ALL ON SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;
    GRANT ALL ON SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${identityRoleName}" WITH GRANT OPTION;
    GRANT ALL ON SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${anonymousRoleName}" WITH GRANT OPTION;

    GRANT ALL ON SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;

    GRANT ALL ON ALL TABLES IN SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;
    GRANT ALL ON ALL PROCEDURES IN SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;  
    GRANT ALL ON ALL ROUTINES IN SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}" TO "${adminRoleName}" WITH GRANT OPTION;  
    GRANT "${identityRoleName}" TO "${adminRoleName}" WITH ADMIN OPTION;
    GRANT "${anonymousRoleName}" TO "${adminRoleName}" WITH ADMIN OPTION;
    GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DATABASE_NAME} TO "${adminRoleName}" WITH GRANT OPTION;
  `);
  const values = _.join(_.map(_.range(0, PROJECT_AMOUNT), () => {
    return `($1)`;
  }), ',');

  await pgPool.query(`
    INSERT INTO "${POSTGRES_PUBLIC_SCHEMA_NAME}"."${PROJECT_TABLE_NAME}" (name)
    VALUES ${values};
  `, ['Test Project']);
};

export const setupTestApp = async (): Promise<void> => {
  await setupTestContainers();
  await setupEnv();
  await setupDatabase();

  const process = require('../../process');
  await process.startProcess();
};

export const shutdownTestApp = async (): Promise<void> => {
  const process = require('../../process');

  await process.stopProcess();
  await shutdownTestContainers();
};