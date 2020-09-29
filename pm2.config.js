const {
  SERVICE_NAME,
  PM2_WATCH_DELAY,
  PM2_MAX_RESTARTS,
  DEFAULT_DEBUG_PORT,
} = process.env;

module.exports = {
  apps: [      
    {
      name: SERVICE_NAME,
      script: 'src/index.js',
      watch: true,
      watch_delay: PM2_WATCH_DELAY,
      max_restarts: PM2_MAX_RESTARTS,
      ignore_watch: ['node_modules'],
      watch_options: {
        usePolling: true,
      },              
      interpreter: '/usr/local/bin/node',
      interpreter_args: `--inspect=0.0.0.0:${DEFAULT_DEBUG_PORT}`,
    }
  ]
};