import { Application, Router } from 'express';
import { Server } from 'net';

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
}