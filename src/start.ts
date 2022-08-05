import logger from './logger';
import { startProcess, stopProcess } from './process';

logger.info(`Starting the main process...`);

process.on('SIGINT', () => {
  stopProcess();
});

(async(): Promise<void> => {
	try {
		await startProcess();
		logger.info(`🚀 Ready to receive GraphQL requests.`);
	} catch (error) {
		logger.error(`An error occurred during startup:`);
		logger.error(error);
		process.exit(1);
	}
})();


