const { GraphQLString } = require('graphql');
const { 
  makePluginByCombiningPlugins,
  makeWrapResolversPlugin,
} = require('graphile-utils');

// stand-alone pocket sized node-cache
// to be enhanced, potential memory leak here?
const cacheTTL = {};
const cache = new Proxy({}, {
  set(obj, prop, val) {
    obj[prop] = val;
    cacheTTL[prop] = setTimeout(() => {
      delete cache[prop];
    }, 10 * 1000);
  }
});

module.exports = makePluginByCombiningPlugins(

  function addShortcutArgument(builder) {
    builder.hook('GraphQLObjectType:fields:field:args', (args, { extend }) => {

      // guard: skip fields that already have the shortcuts field
      if (args.shortcut !== undefined) {
        return args;
      }

      return extend(args, {
        shortcut: {
          description: `Create a single shortcut to this field's result under a specific key.`,
          type: GraphQLString
        },
        shortcutCollection: {
          description: `Create a shortcut collection to this field's result under a specific key.`,
          type: GraphQLString
        }
      });
    });
  },

  function addShortcutField(builder, { pgExtendedTypes }) {
    builder.hook('GraphQLObjectType:fields', (
      fields,
      { extend, getTypeByName },
      { scope: { isRootQuery, isRootMutation } }
    ) => {
      
      // only allow the shortcuts field in the root query to avoid schema pollution
      if (!isRootQuery && !isRootMutation) {
        return fields;
      }

      // guard: skip fields that already have the shortcuts field
      // because this function is run twice for both queries and subscriptions
      if (fields.shortcuts !== undefined) {
        return fields;
      }

      return extend(fields, {
        shortcuts: {
          type: getTypeByName('JSON'),
          async resolve() {
            const [,, { pgClient: { processID } }] = arguments;
            if (!cache[processID]) {
              cache[processID] = {};
            }

            return cache[processID];
          },
        },
      });
    });
  },

  makeWrapResolversPlugin(
    (context, build, field, opts) => {
      return { scope: context.scope };
    },
    ({ scope }) => async (resolver, user, args, { pgClient: { processID } }, _resolveInfo) => {
      const resolved = await resolver();
      const argKeys = Object.keys(args);
      let shortcutData = resolved;

      // check if the resolved field contains the data field
      if (resolved && Object.prototype.hasOwnProperty.call(resolved, `data`)) {
        shortcutData = resolved.data;
      }

      if (!cache[processID]) {
        cache[processID] = {};
      }

      // check if we should filter on potential administrative keys
      // for example __identifiers used by postgraphile
      if (shortcutData && typeof shortcutData === 'object') {
        for (shortcutDataKey of Object.keys(shortcutData)) {
          if (shortcutDataKey.match(/^__/g)) {
            delete shortcutData[shortcutDataKey];
          }
        }
      }

      if (argKeys.includes('shortcut')) {
        cache[processID][args.shortcut] = shortcutData;
      }

      // check for a collection should be stored
      if (argKeys.includes('shortcutCollection')) {
        if (!cache[processID][args.shortcutCollection]) {
          cache[processID][args.shortcutCollection] = {
            totalCount: 0,
            nodes: [],
          };
        }

        cache[processID][args.shortcutCollection].totalCount ++;
        cache[processID][args.shortcutCollection].nodes.push(shortcutData);
      }

      return resolved;
    }
  )

);
