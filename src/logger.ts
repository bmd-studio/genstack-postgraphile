import debug from 'debug';
import chalk from 'chalk';

import environment from './environment';

const {
  DEBUG_NAMESPACE,
} = environment.env;

const infoInstance = debug(`${DEBUG_NAMESPACE}:info`);
const errorInstance = debug(`${DEBUG_NAMESPACE}:error`);
const verboseInstance = debug(`${DEBUG_NAMESPACE}:verbose`);

debug.enable(environment.env.DEBUG);

export const info = (...args: any[]): void => {
  return infoInstance(chalk.blue('[INFO]'), ...args);
};

export const error = (...args: any[]): void => {
  return errorInstance(chalk.red('[ERROR]'), ...args);
};

export const verbose = (...args: any[]): void => {
  return verboseInstance(chalk.red('[VERBOSE]'), ...args);
};

export default {
  info,
  error,
  verbose
};
