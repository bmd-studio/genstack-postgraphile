const {
  SERVICE_NAME = 'postgraphile',
  PM2_WATCH_DELAY = 200,
  PM2_MAX_RESTARTS = Number.MAX_VALUE,
} = process.env;

module.exports = {
  apps: [       
    {
      name: SERVICE_NAME,
      script: 'yarn',
      interpreter: 'yarn',
      interpreter_args: `start:debug`,
      watch: true,
      watch_delay: PM2_WATCH_DELAY,
      max_restarts: PM2_MAX_RESTARTS,
      ignore_watch: ['node_modules'],
      watch_options: {
        usePolling: true,
      },              
    },
  ],
};