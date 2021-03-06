import crypto from 'crypto';
import http from 'http';
import https from 'https';
import url from 'url';

import isObject from 'isobject';

import { HTTPError } from './errors';

const defaultMaxRedirects = 5;
const maximumRedirects = 15;

// Keep a reference of the HTTP agents we create in memory. The key is the hash
// of the agent options.
const cachedAgents = {};

// The valid http(s).Agent options we know of and their casting function.
const validAgentsOptions = {
  keepAlive: Boolean,
  keepAliveMsecs: Number,
  maxSockets: Number,
  maxFreeSockets: Number,
  rejectUnauthorized: Boolean,
  secureProtocol: String,
};

function normalize(path) {
  return path.replace(/\/{2,}/g, '/');
}

function toHashStr(accumulator, [key, value]) {
  return (accumulator += `${key}${value}`);
}

/**
 * Create an hash from the key-values from the options object.
 *
 * @param  {Object} options     The http.Agent options to hash.
 * @param  {Object} httpOptions The http options to hash (only host and port).
 * @return {String} The hashed string.
 */
function optionsToHash(options, httpOptions, protocol = 'http') {
  let toHash;

  const hash = crypto.createHash('sha1');

  toHash = `${protocol}${httpOptions.host}:${httpOptions.port}-`;
  Object.entries(options).reduce(toHashStr, toHash);

  hash.update(toHash);
  return hash.digest('hex');
}

/**
 * Gets or create the HTTP agent.
 *
 * @param {Object} agentOptions The agent options.
 * @param {Object} httpOptions The http options.
 * @param {Boolean} secure If the connection is secure (HTTPS), defaults to false.
 * @return {Object} The `http.Agent` or `https.Agent` instance.
 */
function getOrCreateAgent(agentOptions, httpOptions, secure = false) {
  let agent;

  const key = optionsToHash(
    agentOptions,
    httpOptions,
    secure ? 'https' : 'http'
  );

  /* eslint-disable security/detect-object-injection */
  if (!cachedAgents[key]) {
    if (secure) {
      agent = new https.Agent(agentOptions);
    } else {
      agent = new http.Agent(agentOptions);
    }

    cachedAgents[key] = {
      agent: agent,
      keepAlive: agentOptions.keepAlive,
      lastUsed: Date.now(),
    };
  } else {
    agent = cachedAgents[key].agent;
    cachedAgents[key].lastUsed = Date.now();
  }

  return agent;
  /* eslint-enable security/detect-object-injection */
}

/**
 * Create a new HTTPAgent to be used for establishing an HTTP[S] connection.
 *
 * The HTTPAgent is used to old information for connecting to a remote.
 * It will also hold the real `http.Agent` reference to be used.
 *
 * @property   {Object} agentOptions  The `http.Agent` parameters, same as the
 *                                    ones available in nodejs.
 * @property   {Object} http          The `http.Agent` reference.
 * @property   {Object} httpOptions   The parameters for the HTTP connections,
 *                                    same as the ones available in nodejs
 *                                    `http.request`.
 * @property   {Object} options       General HTTP parameters.
 *
 * The `options` property contains the following property:
 *
 * @property   {Boolean} followRedirects If, in case of redirects, the library
 *                                      should follow them.
 * @property   {Number} maxRedirects    Maximum number of redirects to follow.
 *                                      By default is 5, with a maximum
 *                                      settable value of 15.
 *
 * @class      RequestAgent (name)
 */
export class RequestAgent {
  constructor() {
    // The http module (http or https).
    this.http = undefined;

    // http.request options.
    this.httpOptions = {
      method: 'GET',
      agent: false,
      headers: {
        'Accept-Encoding': 'gzip, deflate, identity',
      },
    };

    // http.Agent options.
    this.agentOptions = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxFreeSockets: 256,
      maxSockets: 2048,
      rejectUnauthorized: true,
    };

    // Internal options.
    this.followRedirects = true;
    this.maxRedirects = defaultMaxRedirects;
    this.newAgent = false;
  }
}

/**
 * Parse URL strings into URL objects.
 *
 * Resolves the new URL based on the old one.
 *
 * @param  {String} oldUrl The old URL.
 * @param  {String} newUrl The new URL.
 * @return {Array}       Array with two URL Objects; the new URL is resolved
 *                       against the old one.
 */
RequestAgent.prototype.toURLs = function (oldUrl, newUrl) {
  return [new url.URL(oldUrl), new url.URL(newUrl, oldUrl)];
};

/**
 * Update the current RequestAgent with a new URL.
 *
 * @param  {URL} oldURL The old connection URL.
 * @param  {URL} newURL The new connection URL.
 */
RequestAgent.prototype.update = function (oldURL, newURL) {
  this.httpOptions.hostname = newURL.hostname;
  this.httpOptions.port = newURL.port;
  this.httpOptions.path = normalize(`${newURL.pathname}${newURL.search}`);
  this.httpOptions.protocol = newURL.protocol;
  this.httpOptions.port = newURL.port;

  if (!newURL.port) {
    if (newURL.protocol.startsWith('https')) {
      this.httpOptions.port = 443;
    } else {
      this.httpOptions.port = 80;
    }
  }

  if (
    oldURL.protocol !== newURL.protocol ||
    oldURL.hostname !== newURL.hostname
  ) {
    if (newURL.protocol.startsWith('https')) {
      if (this.newAgent) {
        this.httpOptions.agent = false;
      } else {
        this.httpOptions.agent = getOrCreateAgent(
          this.agentOptions,
          this.httpOptions,
          true
        );
      }

      this.http = https;
    } else {
      if (this.newAgent) {
        this.httpOptions.agent = false;
      } else {
        this.httpOptions.agent = getOrCreateAgent(
          this.agentOptions,
          this.httpOptions
        );
      }

      this.http = http;
    }
  }
};

/**
 * Set the instance options.
 *
 * @param  {Object} options   The options object to start from.
 * @return {Object}           This instance.
 */
RequestAgent.prototype.setOptions = function (options = {}) {
  let maxRedirects;

  this.newAgent = Boolean(options.newAgent);

  if (options.followRedirects != null) {
    this.followRedirects = Boolean(options.followRedirects);
  }

  maxRedirects = Number(options.maxRedirects);
  if (!isNaN(maxRedirects)) {
    if (maxRedirects >= maximumRedirects) {
      this.maxRedirects = maximumRedirects;
    } else {
      this.maxRedirects = maxRedirects;
    }
  }

  return this;
};

/**
 * Set the `http.Agent` options.
 *
 * @param  {Object} options The options object to start from.
 * @return {Object}         This instance.
 */
RequestAgent.prototype.setAgentOptions = function (options) {
  Object.keys(validAgentsOptions).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      this.agentOptions[`${key}`] = options[`${key}`];
    }
  });

  return this;
};

/**
 * Set the options for the `http.request`.
 *
 * @param  {String} uri     The URL to connect to.
 * @param  {Object} options The options object to start from.
 * @return {Object}         This instance.
 */
RequestAgent.prototype.setHTTPOptions = function (uri, options = {}) {
  let port;

  const reqURL = new url.URL(uri);

  port = parseInt(reqURL.port, 10);
  port = isNaN(port) ? null : port;

  this.httpOptions.hostname = reqURL.hostname;
  this.httpOptions.path = normalize(`${reqURL.pathname}${reqURL.search}`);
  this.httpOptions.port = port;
  this.httpOptions.protocol = reqURL.protocol;

  if (port == null) {
    if (reqURL.protocol.startsWith('https')) {
      this.httpOptions.port = 443;
    } else {
      this.httpOptions.port = 80;
    }
  }

  if (options.method) {
    this.httpOptions.method = options.method;
  }

  if (options.headers) {
    Object.assign(this.httpOptions.headers, options.headers);
  }

  if (options.ca) {
    this.httpOptions.ca = options.ca;
  }

  return this;
};

/**
 * Create a new HTTP agent to establish a remote connection.
 *
 * Some of the valid option fields are:
 *     * keepAlive: Boolean
 *     * keepAliveMsecs: Number
 *     * maxFreeSockets: Number
 *     * maxSockets: Number
 *     * rejectUnauthorized: Boolean
 *     * method: String
 *     * headers: Object
 *     * secureProtocol: String
 *     * followRedirects: Boolean indicating if redirects need to be followed.
 *     * maxRedirects: The maximum number of redirects with an internal maximum
 *                     of 15.
 *
 * @param  {String} uri The URL where to establish the connection.
 * @param  {Object} options The options object to setup the connectio and the
 * agent.
 * @return {RequestAgent} A RequestAgent that will contain the connection options
 * and the http(s).Agent.
 */
export function createAgent(uri, options = {}) {
  if (!isObject(options)) {
    throw new HTTPError('options parameter must be an object');
  }

  if (!uri.startsWith('http')) {
    throw new HTTPError('Unsupported protocol');
  }

  const agent = new RequestAgent();

  agent
    .setOptions(options)
    .setHTTPOptions(uri, options)
    .setAgentOptions(options);

  if (agent.httpOptions.protocol.startsWith('https')) {
    if (!agent.newAgent) {
      agent.httpOptions.agent = getOrCreateAgent(
        agent.agentOptions,
        agent.httpOptions,
        true
      );
    }

    agent.http = https;
  } else {
    if (!agent.newAgent) {
      agent.httpOptions.agent = getOrCreateAgent(
        agent.agentOptions,
        agent.httpOptions
      );
    }

    agent.http = http;
  }

  return agent;
}

export default createAgent;
