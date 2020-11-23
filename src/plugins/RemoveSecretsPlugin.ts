import { SchemaBuilder } from 'graphile-build'
import { flatten, split, omit } from 'lodash';

import environment from '../environment';

const {
  POSTGRES_IDENTITY_SECRET_COLUMN_NAME,
  POSTGRES_HIDDEN_COLUMN_NAMES,
} = environment.env;

const hiddenColumnNames = flatten([
  POSTGRES_IDENTITY_SECRET_COLUMN_NAME,
  ...split(POSTGRES_HIDDEN_COLUMN_NAMES, ',')
]);

export default (builder: SchemaBuilder): void => {
  builder.hook("GraphQLObjectType:fields", (fields) => {
    return omit(fields, hiddenColumnNames);
  });
};