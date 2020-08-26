#! /bin/bash -x   
if [ "$GS_ENV" == "development" ]; then
    echo "Running development mode..."
    echo "Attempting to run using PM2 with watch..."
    echo "
module.exports = {
    apps: [
        {
            name: '$SERVICE_NAME',
            script: './src/index.js',
            watch: true,
            watch_delay: process.env.PM2_WATCH_DELAY,
            max_restarts: process.env.PM2_MAX_RESTARTS,          
            ignore_watch: ['node_modules'],
            watch_options: {
                usePolling: true,
            },              
            interpreter: '/usr/local/bin/node',
            interpreter_args: '--inspect=0.0.0.0:$DEFAULT_DEBUG_PORT',
        }
    ]
}" >> /tmp/pm2.config.js
    pm2-runtime start /tmp/pm2.config.js
else
    echo "Running production mode..."
    node "src/index.js"
fi
