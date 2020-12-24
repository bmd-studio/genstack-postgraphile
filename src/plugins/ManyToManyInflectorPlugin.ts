import { makeAddInflectorsPlugin } from 'graphile-utils';

export default makeAddInflectorsPlugin(
  {
    manyToManyRelationByKeys(
      _leftKeyAttributes,
      _junctionLeftKeyAttributes,
      _junctionRightKeyAttributes,
      _rightKeyAttributes,
      _junctionTable,
      rightTable,
      _junctionLeftConstraint,
      junctionRightConstraint
    ) {
      if (junctionRightConstraint.tags.manyToManyFieldName) {
        return `${junctionRightConstraint.tags.manyToManyFieldName}Nested`;
      }
      // @ts-ignore
      return this.camelCase(`${this.pluralize(this._singularizedTableName(rightTable))}-nested`);
    },
    manyToManyRelationByKeysSimple(
      _leftKeyAttributes,
      _junctionLeftKeyAttributes,
      _junctionRightKeyAttributes,
      _rightKeyAttributes,
      _junctionTable,
      rightTable,
      _junctionLeftConstraint,
      junctionRightConstraint
    ) {
      if (junctionRightConstraint.tags.manyToManySimpleFieldName) {
        return `${junctionRightConstraint.tags.manyToManySimpleFieldName}List`;
      }
      // @ts-ignore
      return this.camelCase(`${this.pluralize(this._singularizedTableName(rightTable))}-list`);
    },
  },
  true // Passing true here allows the plugin to overwrite existing inflectors.
);