const http = require('http');

const graphqlPath = process.env.GRAPHQL_PATH || '/graphql';
const graphqlPort = process.env.DEFAULT_HTTP_PORT || 4000;
const data = JSON.stringify({
  query: `query {
    __typename
  }`
});
const options = {
  host: '0.0.0.0',
  port: graphqlPort,
  path: graphqlPath,
  method: 'POST',
  timeout: 2000,
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
};

const healthCheck = http.request(options, (response) => {

    // check for valid response
    if (response.statusCode === 200) {
      console.log(`HEALTHCHECK VALID`);
      process.exit(0);
    }

    console.log(`HEALTHCHECK INVALID: ${response.statusCode}`);
    process.exit(1);
});

healthCheck.on('error', function (error) {
  console.error('HEALTHCHECK ERROR');
  process.exit(1);
});

healthCheck.write(data);
healthCheck.end();