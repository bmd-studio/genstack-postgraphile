import { startProcess, stopProcess } from './process';

process.on('SIGINT', () => {
  stopProcess();
});

(async(): Promise<void> => {
  startProcess();
})();


