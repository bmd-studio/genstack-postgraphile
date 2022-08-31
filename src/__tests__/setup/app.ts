import _ from 'lodash';
import pg, { Pool } from 'pg';
import { GenericContainer, Network, StartedNetwork, StartedTestContainer } from 'testcontainers';
import getPort from 'get-port';

import logger from '../../logger';
import environment, { isTestingContainer } from '../../environment';

const POSTGRES_INTERNAL_PORT = 5432;
const MQTT_INTERNAL_PORT = 1883;
const HTTP_INTERNAL_PORT = 4000;

const POSTGRES_DOCKER_IMAGE = 'postgres:13.2-alpine';
const MQTT_DOCKER_IMAGE = 'eclipse-mosquitto:1.6.14';
const POSTGRAPHILE_DOCKER_IMAGE = 'ghcr.io/bmd-studio/genstack-postgraphile:latest';

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
export const DEFAULT_PROJECT_NAME = 'Test Project';
export const DEFAULT_PROJECT_POSITION = 10;

// The project amount determines the amount of projects seeded in the database,
// but also the amount of database events trigger AT ONCE (the testing query updates all queries).
// This provides a good stress tester for this service to see how fast it can run.
// Note that if you want to stress test with more you likely need to increase the test timeout in your jest config.
export const PROJECT_AMOUNT = parseInt(process?.env?.PROJECT_AMOUNT ?? '10000');

let network: StartedNetwork;
let pgContainer: StartedTestContainer;
let mqttContainer: StartedTestContainer;
let postgraphileContainer: StartedTestContainer;

const setupContainers = async(): Promise<void> => {
	logger.info('Initializing network...');
  network = await new Network()
    .start();

	logger.info(`Initializing Postgres container: ${POSTGRES_DOCKER_IMAGE}`);
  pgContainer = await new GenericContainer(POSTGRES_DOCKER_IMAGE)
    .withNetworkMode(network.getName())
    .withExposedPorts(POSTGRES_INTERNAL_PORT)
    .withEnv('POSTGRES_USER', POSTGRES_SUPER_USER_ROLE_NAME)
    .withEnv('POSTGRES_PASSWORD', POSTGRES_SUPER_USER_SECRET)
    .withEnv('POSTGRES_DB', POSTGRES_DATABASE_NAME)
    .start();

	logger.info(`Initializing MQTT container: ${MQTT_DOCKER_IMAGE}`);
  mqttContainer = await new GenericContainer(MQTT_DOCKER_IMAGE)
    .withNetworkMode(network.getName())
    .withExposedPorts(MQTT_INTERNAL_PORT)
    .start();

	logger.info(`All containers are now running!`);
};

const setupTestContainer = async(): Promise<void> => {
	const postgresHostName = pgContainer?.getIpAddress(network.getName());
	const postgresPort = String(environment.env.POSTGRES_PORT);

	logger.info(`Initializing Postgraphile container: ${POSTGRAPHILE_DOCKER_IMAGE}`);
	logger.info(`Connecting to Postgres on ${postgresHostName}:${postgresPort}`);

  postgraphileContainer = await new GenericContainer(POSTGRAPHILE_DOCKER_IMAGE)
    .withNetworkMode(network.getName())
    .withExposedPorts(HTTP_INTERNAL_PORT)
    .withEnv('APP_PREFIX', APP_PREFIX)
    .withEnv('DEFAULT_HTTP_PORT', String(HTTP_INTERNAL_PORT))
    .withEnv('GS_ENV', 'staging') // to allow anonymous users for testing

    .withEnv('POSTGRES_HOST_NAME', postgresHostName)
    .withEnv('POSTGRES_PORT', postgresPort)
    .withEnv('POSTGRES_DATABASE_NAME', POSTGRES_DATABASE_NAME)
    .withEnv('POSTGRES_SUPER_USER_ROLE_NAME', POSTGRES_SUPER_USER_ROLE_NAME)
    .withEnv('POSTGRES_SUPER_USER_SECRET', POSTGRES_SUPER_USER_SECRET)
    .withEnv('POSTGRES_ADMIN_ROLE_NAME', POSTGRES_ADMIN_ROLE_NAME)
    .withEnv('POSTGRES_ADMIN_SECRET', POSTGRES_ADMIN_SECRET)
    .withEnv('POSTGRES_IDENTITY_ROLE_NAME', POSTGRES_IDENTITY_ROLE_NAME)
    .withEnv('POSTGRES_IDENTITY_SECRET', POSTGRES_IDENTITY_SECRET)
    .withEnv('POSTGRES_ANONYMOUS_ROLE_NAME', POSTGRES_ANONYMOUS_ROLE_NAME)
    .withEnv('POSTGRES_ANONYMOUS_SECRET', POSTGRES_ANONYMOUS_SECRET)
    .withEnv('POSTGRES_DEFAULT_SCHEMA_NAME', POSTGRES_DEFAULT_SCHEMA_NAME)
    .withEnv('POSTGRES_PUBLIC_SCHEMA_NAME', POSTGRES_PUBLIC_SCHEMA_NAME)
    .withEnv('POSTGRES_PRIVATE_SCHEMA_NAME', POSTGRES_PRIVATE_SCHEMA_NAME)
    .withEnv('POSTGRES_HIDDEN_SCHEMA_NAME', POSTGRES_HIDDEN_SCHEMA_NAME)

    .withEnv('GRAPHQL_DATABASE_SCHEMA', POSTGRES_PUBLIC_SCHEMA_NAME)

    .withEnv('MQTT_HOST_NAME', mqttContainer?.getIpAddress(network.getName()))
    .withEnv('MQTT_PORT', String(MQTT_INTERNAL_PORT))
    .withEnv('GRAPHQL_MQTT_SUBSCRIPTIONS_ENABLED', 'true')
    .start();

		logger.info(`Postgraphile container is now running and listening on port: ${HTTP_INTERNAL_PORT}`);
};

const shutdownContainers = async(): Promise<void> => {
  await pgContainer?.stop();
  await mqttContainer?.stop();
  await postgraphileContainer?.stop();
};

const setupEnv = async (): Promise<void> => {
  const httpPort = postgraphileContainer?.getMappedPort(HTTP_INTERNAL_PORT) ?? await getPort();
	const postgresPort = pgContainer?.getMappedPort(POSTGRES_INTERNAL_PORT).toString();

  _.assignIn(process.env, {
    NODE_ENV: 'development',
    GS_ENV: 'development',
    APP_PREFIX,
    DEFAULT_HTTP_PORT: httpPort,

    POSTGRES_HOST_NAME,
    POSTGRES_PORT: postgresPort,
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
    MQTT_PORT: mqttContainer?.getMappedPort(MQTT_INTERNAL_PORT).toString(),
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

	logger.info(`Database is being setup with admin role: ${adminRoleName}`);
  await pgPool.query(`
    CREATE EXTENSION "uuid-ossp";

    CREATE SCHEMA "${POSTGRES_PUBLIC_SCHEMA_NAME}";
    CREATE SCHEMA "${POSTGRES_PRIVATE_SCHEMA_NAME}";
    CREATE SCHEMA "${POSTGRES_HIDDEN_SCHEMA_NAME}";

    CREATE TABLE "${POSTGRES_PUBLIC_SCHEMA_NAME}"."${PROJECT_TABLE_NAME}" (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      position integer,
      name text
    );
    CREATE INDEX position_index ON "${POSTGRES_PUBLIC_SCHEMA_NAME}"."${PROJECT_TABLE_NAME}" (position);
    CREATE INDEX name_index ON "${POSTGRES_PUBLIC_SCHEMA_NAME}"."${PROJECT_TABLE_NAME}" (name);

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
    return `($1, $2)`;
  }), ',');

  await pgPool.query(`
    INSERT INTO "${POSTGRES_PUBLIC_SCHEMA_NAME}"."${PROJECT_TABLE_NAME}" (name, position)
    VALUES ${values};
  `, [DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_POSITION]);

	logger.info(`Database is setup and seeded with data!`);
};

export const setupTestApp = async (): Promise<void> => {
	logger.info(`Setting up test app...`);
  await setupContainers();
  await setupEnv();
  await setupDatabase();

  if (isTestingContainer()) {
		logger.info(`Setting up the test container...`);
    await setupTestContainer();

    // we need to setup the env twice after the test container
    // is also booted which exposes the mapped graphql port
    await setupEnv();
  } else {
		logger.info(`Setting up the Node environment...`);
    const process = require('../../process');
    await process.startProcess();
  }
};

export const shutdownTestApp = async (): Promise<void> => {
	logger.info('Shutting down test app...');
  const process = require('../../process');

  await process.stopProcess();
  await shutdownContainers();
};
