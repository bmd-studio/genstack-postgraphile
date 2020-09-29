#!/bin/sh -x

if [ "$GS_ENV" == "development" ]; then
    echo "Setting up development..."
else
    echo "Setting up production..."
    npm prune --production
fi

if [ -d "$DOCKER_CONTAINER_PLUGINS_PATH" ]; then
    echo "Installing plugin dependencies..."
    cd $DOCKER_CONTAINER_PLUGINS_PATH
    yarn --frozen-lockfile 

    if [ "$GS_ENV" == "development" ]; then
        echo "Setting up plugins in development..."
    else
        echo "Setting up plugins in production..."
        npm prune --production
    fi
else 
    echo "Plugins in $DOCKER_CONTAINER_PLUGINS_PATH do not exist, skipping..."
fi


