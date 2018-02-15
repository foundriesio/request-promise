const URL = require('url');
const crypto = require('crypto');
const debug = require('debug')('request-promise');
const http = require('http');
const https = require('https');

const {isNull, isObject, isString} = require('./checks');
const {RequestAgentError} = require('./errors');

const DEFAULT_MAX_REDIRECTS = 5;
const MAX_REDIRECTS = 15;

// Keep a reference of the HTTP agents we create in memory. The key is the hash
// of the agent options.
const AGENTS = {};

// The valid http(s).Agent options we know of and their casting function.
const VALID_AGENT_OPTS = {
    keepAlive: Boolean,
    keepAliveMsecs: Number,
    maxSockets: Number,
    maxFreeSockets: Number,
    rejectUnauthorized: Boolean,
    secureProtocol: String,
};

function normalize(path) {
    return path.replace(/\/{2,}/g, '\/');
}

/**
 * Create an hash from the key-values from the options object.
 *
 * @param  {Object} options     The http.Agent options to hash.
 * @param  {Object} httpOptions The http options to hash (only host and port).
 * @return {String}             The hash string.
 */
function optionsToHash(options, httpOptions, protocol = 'http') {
    let hash;
    let toHash;

    debug('Calculating http.Agent hash from options');

    toHash = `${protocol}${httpOptions.host}:${httpOptions.port}`;
    Object.keys(options).forEach((key) => {
        toHash += `${key}${options.key}`;
    });

    hash = crypto.createHash('md5');
    hash.update(toHash);

    return hash.digest('hex');
}

/**
 * Get or create the HTTP agent.
 *
 * @param      {Object}  agentOptions  The agent options
 * @param      {Object}  httpOptions   The http options
 * @return     {Object}  The `http.Agent` instance.
 */
function getOrCreateHTTPAgent(agentOptions, httpOptions) {
    const agentKey = optionsToHash(agentOptions, httpOptions);

    if (!AGENTS[agentKey]) {
        AGENTS[agentKey] = new http.Agent(agentOptions);
    }

    return AGENTS[agentKey];
}

/**
 * Gets or create the HTTPS agent.
 *
 * @param      {Object}  agentOptions  The agent options
 * @param      {Object}  httpOptions   The http options
 * @return     {Object}  The `http.Agent` instance.
 */
function getOrCreateHTTPSAgent(agentOptions, httpOptions) {
    const agentKey = optionsToHash(agentOptions, httpOptions, 'https');

    if (!AGENTS[agentKey]) {
        AGENTS[agentKey] = new https.Agent(agentOptions);
    }

    return AGENTS[agentKey];
}

/**
 * Create a new HTTPAgent to be used for establishing an HTTP[S] connection.
 *
 * The HTTPAgent is used to old information for connecting to a remote URL.
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
 * property   {Boolean} followRedirects If, in case of redirects, the library
 *                                      should follow them.
 * @property   {Number} maxRedirects    Maximum number of redirects to follow.
 *                                      By default is 5, with a maximum
 *                                      settable value of 15.
 *
 * @class      HTTPAgent (name)
 */
class RequestAgent {
    constructor() {
        // The http module (http or https).
        this.http = undefined;

        // http.request options.
        this.httpOptions = {
            method: 'GET',
            agent: false,
            headers: {
                'Accept-Encoding': 'gzip, deflate, identity'
            }
        };

        // http.Agent options.
        this.agentOptions = {
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxFreeSockets: 256,
            maxSockets: 2048,
            rejectUnauthorized: true
        };

        // Internal options.
        this.followRedirects = true;
        this.maxRedirects = DEFAULT_MAX_REDIRECTS;
        this.newAgent = false;
    }
}

/**
 * Update the current RequestAgent with a new URL.
 *
 * @param  {String} oldUrl The old connection URL.
 * @param  {String} newUrl The new connection URL.
 * @return {URL}           The parsed new URL.
 */
RequestAgent.prototype.update = function(oldUrl, newUrl) {
    const prevLocation = URL.parse(oldUrl);
    const newLocation = URL.parse(URL.resolve(oldUrl, newUrl));

    this.httpOptions.host = newLocation.hostname;
    this.httpOptions.port = newLocation.port;
    this.httpOptions.path = normalize(newLocation.path);
    this.httpOptions.protocol = newLocation.protocol;
    this.httpOptions.port = newLocation.port;

    if (isNull(this.httpOptions.port)) {
        if (this.httpOptions.protocol.startsWith('https')) {
            this.httpOptions.port = 443;
        } else {
            this.httpOptions.port = 80;
        }
    }

    if ((prevLocation.protocol !== newLocation.protocol) ||
            (prevLocation.hostname !== newLocation.hostName)) {
        if (newLocation.protocol.startsWith('https')) {
            if (this.newAgent) {
                this.httpOptions.agent = false;
            } else {
                this.httpOptions.agent = getOrCreateHTTPSAgent(
                    this.agentOptions, this.httpOptions);
            }

            this.http = https;
        } else {
            if (this.newAgent) {
                this.httpOptions.agent = false;
            } else {
                this.httpOptions.agent = getOrCreateHTTPAgent(
                    this.agentOptions, this.httpOptions);
            }

            this.http = http;
        }
    }

    return newLocation;
};

/**
 * Set the instance options.
 *
 * @param  {Object} options   The options object to start from.
 * @param  {Boolean} newAgent If a new agent needs to be created every time.
 * @return {Object}         This instance.
 */
RequestAgent.prototype.setOptions = function(options, newAgent) {
    let maxRedirects;

    this.newAgent = newAgent;

    if (isObject(options)) {

        if (!isNull(options.followRedirects)) {
            this.followRedirects = Boolean(options.followRedirects);
        }

        maxRedirects = Number(options.maxRedirects);
        if (!isNaN(maxRedirects)) {
            if (maxRedirects >= MAX_REDIRECTS) {
                this.maxRedirects = MAX_REDIRECTS;
            } else {
                this.maxRedirects = maxRedirects;
            }
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
RequestAgent.prototype.setAgentOptions = function(options) {
    if (isObject(options)) {
        Object.keys(VALID_AGENT_OPTS).forEach((key) => {
            if (!isNull(options[key])) {
                this.agentOptions[key] = VALID_AGENT_OPTS[key](options[key]);
            }
        });
    }

    return this;
};

/**
 * Set the options for the `http.request`.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Object} options The options object to start from.
 * @return {Object}         This instance.
 */
RequestAgent.prototype.setHTTPOptions = function(url, options) {
    const requestUrl = URL.parse(url);

    this.httpOptions.protocol = requestUrl.protocol;
    this.httpOptions.host = requestUrl.hostname;
    this.httpOptions.path = normalize(requestUrl.path);
    this.httpOptions.port = requestUrl.port;

    if (isNull(requestUrl.port)) {
        if (requestUrl.protocol.startsWith('https')) {
            this.httpOptions.port = 443;
        } else {
            this.httpOptions.port = 80;
        }
    }

    if (isObject(options)) {
        if (isString(options.method)) {
            this.httpOptions.method = options.method;
        }

        if (isObject(options.headers)) {
            Object.assign(this.httpOptions.headers, options.headers);
        }
    }

    return this;
};

/**
 * Create a new HTTP agent to establish a remote connection.
 *
 * The options is an abject that should contain the following data structures:
 *     * An `agent` object that holds the `http.Agent` options.
 *     * A `http` object that holds the `http.request` options.
 *
 * All other fields will be used for general instance options. Valid fields are:
 *     * followRedirects: Boolean indicating if redirects need to be followed.
 *     * maxRedirects: The maximum number of redirects with an internal maximum
 *                     of 15.
 *
 * @param  {String} url       The URL where to establish the connection.
 * @param  {Object} options   The options object to setup the connectio and the
 *                            agent.
 * @return {RequestAgent}     A RequestAgent that will contain the connection
 *                            options and the http(s).Agent.
 */
function create(url, options) {
    if (url.startsWith('http')) {
        const agent = new RequestAgent();

        agent.setOptions(options)
            .setHTTPOptions(url, options)
            .setAgentOptions(options);

        if (agent.httpOptions.protocol.startsWith('https')) {
            if (!agent.newAgent) {
                agent.httpOptions.agent = getOrCreateHTTPSAgent(agent.agentOptions, agent.httpOptions);
            }

            agent.http = https;
        } else {
            if (!agent.newAgent) {
                agent.httpOptions.agent = getOrCreateHTTPAgent(agent.agentOptions, agent.httpOptions);
            }

            agent.http = http;
        }

        return agent;
    } else {
        throw new RequestAgentError(`URL with unsupported protocol (${url})`);
    }
}

module.exports = {
    RequestAgent: RequestAgent,
    create: create
};
