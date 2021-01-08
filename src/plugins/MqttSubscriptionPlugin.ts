import { SchemaBuilder } from 'graphile-build';
import _ from 'lodash';
import sift from 'sift';
import { snakeCase } from 'change-case';
import { connect } from 'mqtt';
import { withFilter } from 'graphql-subscriptions';
import { MQTTPubSub } from '@bmd-studio/graphql-mqtt-subscriptions';
import { Build, Build as GraphileBuild, Context as GraphileContext } from 'postgraphile';
import chalk from 'chalk';

import environment from '../environment';
import logger from '../logger';
export interface PgEvent {
  isPgEvent: boolean;
  operationName: string;
  tableName: string;
  columnName: string;
  columnValue: string;
}

export type MqttTopic = string;
export type MqttPayload = string;

export interface MqttParsedPayload {
  [key: string]: any;
}

export interface MqttMessage {
  topic: MqttTopic;
  payload: MqttPayload;
}

export interface MqttContext {
  receivedTopic: string;
}

export interface SubscriptionArgs {
  topics: MqttTopic[];
  qos: number;
  filter: object;
  initialize: boolean;
  throttle: number;
  throttleLeading: boolean;
  throttleTrailing: boolean;
}

export interface SubscriptionContext {
  [key: string]: any;
}

export interface SubscriptionInfo {
  [key: string]: any;
}

export interface GraphQLField {
  description: string;
  type: any;
  resolve: Function;
}

export interface MqttMessageGraphQLFields {
  query: GraphQLField;
  topic: GraphQLField;
  message: GraphQLField;
}

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

const INITIALIZE_PAYLOAD_KEY = '__initialize';

const SIFT_OPERATORS = [
  '_in', '_nin', 
  '_exists', 
  '_gte', '_lte', '_lt', '_eq', '_ne', 
  '_mod', '_all', 
  '_and', '_or', '_nor', '_not', 
  '_type', '_regex', 
  '_where', '_elemMatch'
];

const prefixSiftOperators = (filter: object) => {

  // prefix all keys with $ sign to match sift requirements
  filter = _.mapKeys(filter, (_value, key) => {
    return _.includes(SIFT_OPERATORS, key) ? _.replace(key, '_', '$') : key;
  });

  return filter;
};

const splitTopic = (topic: string): string[] => {
  const topicTokens = _.split(topic, '/');

  return topicTokens;
};

const parsePgEvent = (topic: string): PgEvent => {
  const topicTokens = splitTopic(topic);

  return {
    isPgEvent: isPgEvent(topic),
    operationName: _.get(topicTokens, 1),
    tableName: _.get(topicTokens, 2),
    columnName: _.get(topicTokens, 3),
    columnValue: _.get(topicTokens, 4),
  };
};

const isPgEvent = (topic: string): boolean => {
  const topicTokens = splitTopic(topic);
  return (_.get(topicTokens, 0) === MQTT_DATABASE_CHANNEL_PREFIX);
};

class MqttMessageThrottler {
  throttleTime: number;
  throttleLeading: boolean;
  throttleTrailing: boolean;
  queuedMessages: MqttMessage[];
  throttledMessage: MqttMessage | undefined;
  lastQueueIncrease: number;
  lastMessageSent: number;
  handleThrottledQueue: Function;

  constructor(args: SubscriptionArgs) {
    this.throttleTime = args.throttle || POSTGRAPHILE_MQTT_THROTTLE_TIME;
    this.throttleLeading = args.throttleLeading || true;
    this.throttleTrailing = args.throttleTrailing || true;
    this.queuedMessages = [];
    this.throttledMessage = undefined;
    this.lastQueueIncrease = 0;
    this.lastMessageSent = 0;
    this.handleThrottledQueue = _.throttle(this.handleQueue, this.throttleTime, {
      leading: this.throttleLeading,
      trailing: this.throttleTrailing,
    });
  }

  countQueue(): number {
    return this.queuedMessages.length;
  }

  getNextQueuedMessage(): MqttMessage {
    return this.queuedMessages?.[0] || {};
  }

  increaseQueue(topic: MqttTopic, payload: MqttPayload): void {
    this.queuedMessages.push({
      topic,
      payload,
    });
    this.lastQueueIncrease = Date.now();
    logger.verbose(`Increase MQTT message queue count to ${this.countQueue()} on ${this.lastQueueIncrease}`);
  }
  
  decreaseQueue(): void {
    this.throttledMessage = this.queuedMessages.shift();
    logger.verbose(`Decreased MQTT message queue count to ${this.countQueue()}`);
  }

  handleQueue(resolve: Function, reject: Function): void {
    const now = Date.now();
  
    // always decrease the current queue
    this.decreaseQueue();
  
    // guard: make sure the requested time elapsed
    if (now - this.lastMessageSent < this.throttleTime) {
      logger.verbose(`Rejected a throttled MQTT message as the delay (${this.throttleTime}) has not passed yet.`);
      reject(false);
      return;
    }
  
    // finally pass the event to the client
    logger.verbose(`Sending a MQTT message to the client. Decreased message queue count to ${this.countQueue()} on ${now}`);
    this.lastMessageSent = now;
    resolve(true);
  }
}

const getMqttMessageFields = (build: GraphileBuild): MqttMessageGraphQLFields => {
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
      resolve(payload: MqttMessage) {
        return payload.topic;
      }
    },
    message: {
      description: 'The payload that was sent along the event.',
      type: GraphQLJSON,
      resolve(payload: MqttMessage) {
        return payload.payload;
      }
    },
  };
};

const getMqttMessageType = (build: GraphileBuild) => {
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
        return getMqttMessageFields(build);
      }
    },
    {},
  ));
};

const getMqttMessageArgs = (build: GraphileBuild) => {
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

const getMqttMessageIterator = (throttler: MqttMessageThrottler, pubsub: MQTTPubSub) => {
  return (_payload: MqttParsedPayload, args: SubscriptionArgs) => {
    const { 
      topics = [],
      qos = MQTT_DEFAULT_QOS,
      initialize = false,
    } = args;

    const subscriptionIdPromises = _.map(topics, (topic) => {
      logger.verbose(`Subscribing to ${topic}...`);
      return pubsub.subscribe(topic, (payload: MqttPayload, context: MqttContext) => {
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

        logger.verbose(`Unsubscribing from subscription with ID ${subscriptionId}...`);
        pubsub.unsubscribe(subscriptionId);
      });

      return realUnsubscribeAll.bind(this)(...arguments);
    };

    // instantly publish an event for this client only when requested
    if (initialize) {
      logger.verbose(`Creating an initialize MQTT message to trigger subscription the first time...`);
      const payload = {
        [INITIALIZE_PAYLOAD_KEY]: true,
      };
      iterator.pushValue(payload);
    }

    return iterator;
  };
};

const getMqttMessageFilter = (throttler: MqttMessageThrottler) => {
  return async (payload: MqttParsedPayload, args: SubscriptionArgs, context: SubscriptionContext): Promise<boolean> => { 
    const {
      pgClient,
    } = context;
    const { 
      filter = {}, 
    } = args;
    const siftFilter = sift(prefixSiftOperators(filter)); 
    const { topic } = throttler.getNextQueuedMessage();
    const isExpired = throttler.lastQueueIncrease <= throttler.lastMessageSent;
    const hasMultipleQueued = throttler.countQueue() > 1;
    const isFilteredOut = _.isEmpty([payload].filter(siftFilter));
    const isInitializeMessage = _.get(payload, INITIALIZE_PAYLOAD_KEY) === true;

    // check if this was an initialization message
    if (isInitializeMessage) {
      return true;
    }

    // check if the message expired, if there are too many messages queued, or if the filter had any results
    // for the filtering we are using the sift npm module where the operators starting with $ are required to start with _ in GraphQL
    if (isExpired || hasMultipleQueued || isFilteredOut) {
      logger.verbose(`Instant skip of a MQTT message due to expiry. Is expired: ${isExpired}, has multiple queued: ${hasMultipleQueued}, is filtered out: ${isFilteredOut}.`);
      throttler.decreaseQueue();
      return false;
    }

    // check if the current user has permissions to view this row by quickly checking the Postgres RLS
    const parsedPgEvent = parsePgEvent(topic);

    // check if the topic is related to the postgres database
    if (parsedPgEvent.isPgEvent) {
      const tableName = snakeCase(parsedPgEvent.tableName);
      const columnName = snakeCase(parsedPgEvent.columnName);
      const columnValue = parsedPgEvent.columnValue;
      let hasAccess = false;

      try {
        const accessSql = `SELECT ${DATABASE_ID_COLUMN_NAME} FROM ${tableName} WHERE ${columnName} = $1 LIMIT 1;`;
        const accessVariables = [columnValue];

        logger.verbose(`Verifying access for MQTT message with SQL: `);
        logger.verbose(accessSql);
        logger.verbose(accessVariables);

        const { rows } = await pgClient.query(accessSql, accessVariables);
        hasAccess = (_.size(rows) === 1);
      } catch (error) {
        // empty
      }

      // guard: skip on no access
      if (!hasAccess) {
        logger.verbose(`Instant skip of a MQTT message due to no access.`);
        throttler.decreaseQueue();
        return false;
      }
    }

    return new Promise((resolve, reject) => {
      logger.verbose(`Attempting MQTT throttle...`);
      return throttler.handleThrottledQueue(resolve, reject);
    });
  };
};

const mqttMessageResolver = async (payload: MqttPayload, args: SubscriptionArgs, context: SubscriptionContext): Promise<MqttMessage> => {
  const { throttler } = context || {};
  const throttledMessage = throttler?.throttledMessage || {};
  const { topic } = throttledMessage;

  return { 
    topic,
    payload,
  };
};

export default (builder: SchemaBuilder): void => {
  let mqttClient;

  try {
    logger.info(`Connecting to MQTT server on ${chalk.underline(MQTT_HOST_NAME)}:${chalk.underline(MQTT_PORT)} with user ${chalk.underline(MQTT_ADMIN_USERNAME)}...`)
    mqttClient = connect(`mqtt://${MQTT_HOST_NAME}:${MQTT_PORT}`, {
      username: MQTT_ADMIN_USERNAME,
      password: MQTT_ADMIN_SECRET,
    });
  } catch (error) {
    logger.error(`Could not connect to MQTT server`);
    logger.error(error);
    process.exit(1);
  }
  logger.info(`Successfully connected to the MQTT server.`);
  
  const pubsub = new MQTTPubSub({
    client: mqttClient,
  });

  // extend the fields
  builder.hook('GraphQLObjectType:fields', (fields, build: Build, graphileContext: GraphileContext<unknown>) => {
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
          type: getMqttMessageType(build),
          args: getMqttMessageArgs(build),
          subscribe: async (payload: string, args: SubscriptionArgs, context: SubscriptionContext, resolveInfo: SubscriptionInfo) => {
            const throttler = new MqttMessageThrottler(args);            
            logger.verbose(`A new MQTT subscription request is received, with arguments:`, args);

            // expand the context with the throttler object
            context.throttler = throttler;

            // add a filter to allow for filtering on the payload per event
            // this makes it easy to customize your event listeners
            const withFilterResult = withFilter(
              getMqttMessageIterator(throttler, pubsub),
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
