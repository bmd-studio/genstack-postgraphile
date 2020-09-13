const _ = require('lodash');
const sift = require('sift').default;
const changeCase = require('change-case');
const connect = require('mqtt').connect;
const withFilter = require('graphql-subscriptions').withFilter;
const MQTTPubSub = require('@bmd-studio/graphql-mqtt-subscriptions').MQTTPubSub;

const environment = require('@bmd-studio/genstack-environment').default;
const logger = require('@bmd-studio/genstack-logger').default;

const {
  MQTT_HOST_NAME = 'localhost',
  MQTT_PORT = 1883,
  MQTT_DEFAULT_QOS = 1,
  MQTT_DATABASE_CHANNEL_PREFIX = 'pg',
  MQTT_ADMIN_USERNAME,
  MQTT_ADMIN_SECRET,

  POSTGRAPHILE_MQTT_THROTTLE_TIME = 50,

  DATABASE_ID_COLUMN_NAME,
} = environment.env;

const mqttClient = connect(`mqtt://${MQTT_HOST_NAME}:${MQTT_PORT}`, {
  username: MQTT_ADMIN_USERNAME,
  password: MQTT_ADMIN_SECRET,
});

const pubsub = new MQTTPubSub({
  client: mqttClient,
});

const SIFT_OPERATORS = [
  '_in', '_nin', 
  '_exists', 
  '_gte', '_lte', '_lt', '_eq', '_ne', 
  '_mod', '_all', 
  '_and', '_or', '_nor', '_not', 
  '_type', '_regex', 
  '_where', '_elemMatch'
];

const prefixSiftOperators = (filter) => {

  // prefix all keys with $ sign to match sift requirements
  filter = _.mapKeys(filter, (value, key) => {
    return _.includes(SIFT_OPERATORS, key) ? _.replace(key, '_', '$') : key;
  });

  return filter;
};

const splitTopic = (topic) => {
  const topicTokens = _.split(topic, '/');

  return topicTokens;
};

const parsePgEvent = (topic) => {
  const topicTokens = splitTopic(topic);

  return {
    isPgEvent: isPgEvent(topic),
    operationName: _.get(topicTokens, 1),
    tableName: _.get(topicTokens, 2),
    columnName: _.get(topicTokens, 3),
    columnValue: _.get(topicTokens, 4),
  };
};

const isPgEvent = (topic) => {
  const topicTokens = splitTopic(topic);
  return _.get(topicTokens, 0) === MQTT_DATABASE_CHANNEL_PREFIX;
};

class MqttMessageThrottler {

  constructor(payload, args, context, resolveInfo) {
    this.throttleTime = args.throttle || POSTGRAPHILE_MQTT_THROTTLE_TIME;
    this.throttleLeading = args.throttleLeading || true;
    this.throttleTrailing = args.throttleTrailing || true;
    this.queuedMessages = [];
    this.throttledMessage = {};
    this.lastQueueIncrease = 0;
    this.lastMessageSent = 0;
    this.handleThrottledQueue = _.throttle(this.handleQueue, this.throttleTime, {
      leading: this.throttleLeading,
      trailing: this.throttleTrailing,
    });
  }

  countQueue() {
    return this.queuedMessages.length;
  }

  getNextQueuedMessage() {
    return _.get(this.queuedMessages, 0, {});
  }

  increaseQueue(topic, payload) {
    this.queuedMessages.push({
      topic,
      payload,
    });
    this.lastQueueIncrease = Date.now();
    logger.verbose.mqttMessage(`Increase message queue count to ${this.countQueue()} on ${this.lastQueueIncrease}`);
  }
  
  decreaseQueue() {
    this.throttledMessage = this.queuedMessages.shift();
    logger.verbose.mqttMessage(`Decreased message queue count to ${this.countQueue()}`);
  }

  handleQueue(resolve, reject) {
    const now = Date.now();
  
    // always decrease the current queue
    this.decreaseQueue();
  
    // guard: make sure the requested time elapsed
    if (now - this.lastMessageSent < this.throttleTime) {
      logger.verbose.mqttMessage(`Rejected a throttled message as the delay (${this.throttleTime}) has not passed yet.`);
      reject(false);
      return;
    }
  
    // finally pass the event to the client
    logger.verbose.mqttMessage(`Sending a message to the client. Decreased message queue count to ${this.countQueue()} on ${now}`);
    this.lastMessageSent = now;
    resolve(true);
  }
}

const getMqttMessageFields = (fields, build, graphileContext) => {
  const {
    getTypeByName,
    $$isQuery,
    inflection,
    graphql: {
      GraphQLString,
    },    
  } = build;
  const GraphQLJSON = getTypeByName('JSON');
  const Query = getTypeByName(inflection.builtin('Query'));

  return {
    query: {
      description: 'Root query field allowing to request any data upon this event.',
      type: Query,
      resolve() {
        return $$isQuery;
      },
    },
    topic: {
      description: 'The topic that caused this event to be triggered.',
      type: GraphQLString,
      resolve(payload, args, context, resolveInfo) {
        return payload.topic;
      }
    },
    message: {
      description: 'The payload that was sent along the event.',
      type: GraphQLJSON,
      resolve(payload, args, context, resolveInfo) {
        return payload.message;
      }
    },
  };
};

const getMqttMessageType = (fields, build, graphileContext) => {
  const {
    newWithHooks,
    graphql: {
      GraphQLObjectType,
      GraphQLNonNull,
    },
  } = build;

  return new GraphQLNonNull(newWithHooks(
    GraphQLObjectType,
    {
      name: 'MqttMessagePayload',
      fields: () => {
        return getMqttMessageFields(fields, build, graphileContext);
      }
    },
    {},
  ));
};

const getMqttMessageArgs = (fields, build, graphileContext) => {
  const {
    getTypeByName,
    graphql: {
      GraphQLNonNull,
      GraphQLString,
      GraphQLBoolean,
      GraphQLInt,
      GraphQLList,
    },
  } = build;
  const GraphQLJSON = getTypeByName('JSON');

  return {
    topics: {
      description: 'The MQTT topics to subscribe to. Wildcards are allowed.',
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    qos: {
      description: 'The quality of service of the message subscriptions (0 = at most once , 1 = at least once or 2 = exactly once)',
      type: GraphQLInt,
    },
    filter: {
      description: 'Only trigger events when the payload in the MQTT message adheres to this filter object.',
      type: GraphQLJSON,
    },
    initialize: {
      description: 'True when the attached query should run on subscribe. Note that the message will be empty. Default is `false`',
      type: GraphQLBoolean,
    },
    throttle: {
      description: 'The minimum amount of milliseconds between events. Defaults to 50ms or your `POSTGRAPHILE_MQTT_THROTTLE_TIME` environment variable.',
      type: GraphQLInt,
    },
    throttleLeading: {
      description: 'True when you want to receive an event directly after the first time it occurs. Default is `true`.',
      type: GraphQLBoolean,
    },
    throttleTrailing: {
      description: 'True when you want to receive an event after the throttled time and after the last time it occurs. Default is `true`.',
      type: GraphQLBoolean,
    },                        
  };
};

const getMqttMessageIterator = (throttler) => {
  return (payload, args, context, resolveInfo) => {
    const { 
      topics = [],
      qos = MQTT_DEFAULT_QOS,
      initialize = false,
    } = args;

    const subscriptionIdPromises = _.map(topics, (topic) => {
      logger.verbose.mqttMessage(`Subscribing to ${topic}...`);
      return pubsub.subscribe(topic, (payload, context) => {
        const { receivedTopic } = context;
        throttler.increaseQueue(receivedTopic, payload);
      }, {
        qos: qos,
      });
    });
    const iterator = pubsub.asyncIterator(topics);

    // hijack the unsubscribe call to make sure the temporary subscribe is cleared from memory
    const realUnsubscribeAll = iterator.unsubscribeAll;
    iterator.unsubscribeAll = async function() {
      _.map(subscriptionIdPromises, async (subscriptionIdPromise) => {
        const subscriptionId = await subscriptionIdPromise;

        logger.verbose.mqttMessage(`Unsubscribing from subscription with ID ${subscriptionId}...`);
        pubsub.unsubscribe(subscriptionId);
      });

      return realUnsubscribeAll.bind(this)(...arguments);
    };

    // instantly publish an event for this client only when requested
    if (initialize) {
      iterator.pushValue({
        __initialize: true,
      });
    }

    return iterator;
  };
};

const getMqttMessageFilter = (throttler) => {
  return async (payload, args, context, resolveInfo) => { 
    const {
      pgClient,
    } = context;
    const { 
      filter = {}, 
    } = args;
    const siftFilter = sift(prefixSiftOperators(filter));    
    const { topic } = throttler.getNextQueuedMessage();
    const isExpired = throttler.lastQueueIncrease <= throttler.lastMessageSent;
    const hasMultipleQueued = throttler.countQueue() !== 1;
    const isFilteredOut = _.isEmpty([payload].filter(siftFilter));
    const isInitializeMessage = _.get(payload, `__initialize`) === true;

    // check if this was an initialization message
    if (isInitializeMessage) {
      return true;
    }

    // check if the message expired, if there are too many messages queued, or if the filter had any results
    // for the filtering we are using the sift npm module where the operators starting with $ are required to start with _ in GraphQL
    if (isExpired || hasMultipleQueued || isFilteredOut) {
      logger.verbose.mqttMessage(`Instant skip of a message due to expiry.`);
      throttler.decreaseQueue();
      return false;
    }

    // check if the current user has permissions to view this row by quickly checking the Postgres RLS
    const parsedPgEvent = parsePgEvent(topic);

    // check if the topic is related to the postgres database
    if (parsedPgEvent.isPgEvent) {
      const tableName = changeCase.snakeCase(parsedPgEvent.tableName);
      const columnName = changeCase.snakeCase(parsedPgEvent.columnName);
      const columnValue = parsedPgEvent.columnValue;
      let hasAccess = false;

      try {
        const accessSql = `SELECT ${DATABASE_ID_COLUMN_NAME} FROM ${tableName} WHERE ${columnName} = $1 LIMIT 1;`;
        const accessVariables = [columnValue];

        logger.verbose.mqttMessage(`Verifying access for message with SQL: `);
        logger.verbose.mqttMessage(accessSql);
        logger.verbose.mqttMessage(accessVariables);

        const { rows } = await pgClient.query(accessSql, accessVariables);
        hasAccess = (_.size(rows) === 1);
      } catch (error) {
        // empty
      }

      // guard: skip on no access
      if (!hasAccess) {
        logger.verbose.mqttMessage(`Instant skip of a message due to no access.`);
        throttler.decreaseQueue();
        return false;
      }
    }

    return new Promise((resolve, reject) => {
      logger.verbose.mqttMessage(`Attempting throttle...`);
      return throttler.handleThrottledQueue(resolve, reject);
    });
  };
};

const mqttMessageResolver = async (payload, args, context, resolveInfo) => {
  const { throttler } = context;
  const throttledMessage = throttler.throttledMessage;
  const { topic } = throttledMessage;
  const result = { 
    topic: topic,
    message: payload,
  };

  return result;
};

module.exports = (builder, args) => {

  // extend the fields
  builder.hook('GraphQLObjectType:fields', (fields, build, graphileContext) => {
    const {
      scope: { isRootSubscription },
      fieldWithHooks,
    } = graphileContext;
    const {
      extend,
    } = build;

    // guard: make sure this is a subscription on root level
    if (!isRootSubscription) {
      return fields;
    }
  
    const mqttMessage = fieldWithHooks(
      'mqttMessage',
      () => {
        return {
          type: getMqttMessageType(fields, build, graphileContext),
          args: getMqttMessageArgs(fields, build, graphileContext),
          subscribe: async (payload, args, context, resolveInfo) => {
            const throttler = new MqttMessageThrottler(payload, args, context, resolveInfo);            
            logger.verbose.mqttMessage(`A new subscription request is received, with arguments:`, args);

            // expand the context with the throttler object
            context.throttler = throttler;

            // add a filter to allow for filtering on the payload per event
            // this makes it easy to customize your event listeners
            const withFilterResult = withFilter(
              getMqttMessageIterator(throttler),
              getMqttMessageFilter(throttler)
            )(payload, args, context, resolveInfo);

            return withFilterResult;
          }, 
          resolve: mqttMessageResolver,
        };
      },
      {}
    );

    // publish this extension under the mqttMessage namespace
    return extend(fields, {
      mqttMessage: mqttMessage,
    });
  });
};
