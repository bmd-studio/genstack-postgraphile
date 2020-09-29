#!/bin/sh -x   

if [ "$GS_ENV" == "development" ]; then
    echo "Running in development..."
    yarn start:dev
else
    echo "Running in production..."
    yarn start:prod
fi
