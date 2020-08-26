#!/bin/bash -x

if [ "$GS_ENV" == "development" ]; then
    echo "Setting up development mode..."
    if ! [ -x "$(command -v npm)" ]; then
        echo "Installing Node..."
        curl -sL https://deb.nodesource.com/setup_12.x | bash -
        apt-get install -y nodejs
    fi
    echo "Installing PM2..."
    npm install pm2@4.4.0 -g
fi

echo "Installing dependencies..."
npm install

if [ -d "$DOCKER_CONTAINER_PLUGINS_PATH" ]; then
    echo "Installing plugin dependencies..."
    cd $DOCKER_CONTAINER_PLUGINS_PATH
    npm install
else 
    echo "Plugins in $DOCKER_CONTAINER_PLUGINS_PATH do not exist, skipping..."
fi

