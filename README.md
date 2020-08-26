# genstack-container-postgraphile

#### Run directly from build
```
MQTT_HOST_NAME=localhost MQTT_PORT=1883 POSTGRES_HOST_NAME=localhost POSTGRES_PORT=6543 DEFAULT_HTTP_PORT=4020 nodemon index.js
MQTT_HOST_NAME=localhost MQTT_PORT=1883 POSTGRES_HOST_NAME=localhost POSTGRES_PORT=6543 DEFAULT_HTTP_PORT=4020 dotenv -e ../../.env nodemon index.js
```