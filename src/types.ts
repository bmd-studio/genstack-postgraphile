import { Application, Router } from 'express';
import { Server } from 'net';

export interface ProcessOptions {
  serverOptions?: ServerOptions;
  postgresOptions?: PostgresOptions;
  graphqlOptions?: GraphQLOptions;
}

export interface ServerOptions {
  port?: number;
  path?: string;
}

export interface PostgresOptions {
  host?: string;
  port?: number;
  superUser?: string;
  superUserPassword?: string;
  adminUser?: string;
  adminUserPassword?: string;
  database?: string;
}

export interface GraphQLOptions {
  databaseSchema?: string;
}

export type AccessToken = string | null;

export interface JwtPayload {
  identity_role?: string;
  identity_id?: string;
  identity?: object;
  alg?: string;
  iat?: string;
  iss?: string;
};

export interface ServerContext {
  app: Application;
  server: Server;
  router: Router;
  processOptions?: ProcessOptions;
}

export type EnvType = 'development' | 'staging' | 'production';
