const _ = require('lodash');

const environment = require('@bmd-studio/genstack-environment').default;

const {
  POSTGRES_IDENTITY_SECRET_COLUMN_NAME,
  POSTGRES_HIDDEN_COLUMN_NAMES,
} = environment.env;

const hiddenColumnNames = _.flatten([
  POSTGRES_IDENTITY_SECRET_COLUMN_NAME,
  ..._.split(POSTGRES_HIDDEN_COLUMN_NAMES, ',')
]);

module.exports = (builder) => {
  builder.hook("GraphQLObjectType:fields", (fields) => {
    return _.omit(fields, hiddenColumnNames);
  });
};