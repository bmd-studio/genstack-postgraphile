#!/bin/sh -x

if [ "$NODE_ENV" == "development" ]; then
    echo "Running in development..."
    yarn start:pm2
else
    echo "Running in production..."
    yarn start:prod
fi
