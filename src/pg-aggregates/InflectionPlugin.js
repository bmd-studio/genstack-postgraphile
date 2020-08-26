"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphile_utils_1 = require("graphile-utils");
exports.default = graphile_utils_1.makeAddInflectorsPlugin({
    aggregateType(table) {
        return this.upperCamelCase(`${this._singularizedTableName(table)}-aggregates`);
    },
    aggregateSumType(table) {
        return this.upperCamelCase(`${this._singularizedTableName(table)}-sum-aggregates`);
    },
    aggregatesField(_table) {
        return "aggregates";
    },
    aggregatesSumField(_table) {
        return "sum";
    },
    summableFieldEnum(table) {
        return this.upperCamelCase(`${this._singularizedTableName(table)}-summable-field-enum`);
    },
});
//# sourceMappingURL=InflectionPlugin.js.map