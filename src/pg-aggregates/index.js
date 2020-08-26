"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphile_utils_1 = require("graphile-utils");
const InflectionPlugin_1 = require("./InflectionPlugin");
const AddAggregatesPlugin_1 = require("./AddAggregatesPlugin");
exports.default = graphile_utils_1.makePluginByCombiningPlugins(InflectionPlugin_1.default, AddAggregatesPlugin_1.default);
//# sourceMappingURL=index.js.map