#!/bin/sh -x

if [ "$NOD_ENV" == "development" ]; then
    echo "Setting up development..."
else
    echo "Setting up production..."
    npm prune --production
fi
