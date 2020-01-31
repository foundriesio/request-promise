const debug = require('debug')('request-promise');
const isStream = require('is-stream');
const zlib = require('zlib');

const agent = require('./lib/agent');
const utils = require('./lib/utils');
const {HTTPError, HTTPConnectionError} = require('./lib/errors');
const {HTTPResponse, HTTPRedirect} = require('./lib/response');

// List of HTTP verbs that support sending data.
const HTTP_DATA_METHODS = [
    'PATCH',
    'POST',
    'PUT'
];

/**
 * Check if the headers object contains a specific header.
 * @param  {String}  value   The name of the header to check.
 * @param  {Object}  headers The object containing all the headers.
 * @return {Boolean}         If the header is available and not null.
 */
function hasHeader(value, headers) {
    if (Object.prototype.hasOwnProperty.call(headers, value.toLowerCase())) {
        return true;
    }
    return false;
}

function handleResponse(response, resolve, reject) {
    let output;
    let result;

    const data = [];

    switch (response.headers['content-encoding']) {
        case 'gzip':
            output = zlib.createGunzip();
            response.pipe(output);
            break;
        case 'deflate':
            output = zlib.createInflate();
            response.pipe(output);
            break;
        default:
            output = response;
    }

    response.on('error', reject);

    output.on('data', (chunck) => {
        data.push(chunck);
    });

    output.on('end', () => {
        const status = response.statusCode;

        if (status >= 200 && status < 300) {
            result = new HTTPResponse('OK');
        } else if (status >= 300 && status <= 310) {
            result = new HTTPRedirect('Redirect');
            result.location = response.headers.location;
        } else {
            result = new HTTPError('HTTP error');
        }

        result.statusCode = response.statusCode;
        result.httpVersion = response.httpVersion;
        result.rawHeaders = response.rawHeaders;
        result.statusMessage = response.statusMessage || 'unknown';
        result.headers = response.headers;
        result.body = Buffer.concat(data);

        if (result instanceof HTTPError) {
            reject(result);
            return;
        }

        resolve(result);
    });
}

/**
 * The internal request method that performs the actual HTTP operation.
 *
 * @param  {HTTP} http      The HTTP client.
 * @param  {Object} options The HTTP options.
 * @param  {Object} data    If a POST request, the data to send.
 * @param  {Object} Future  The Promise object/library to use.
 * @return {Promise}
 */
function _request({http, options, data, Future}) {
    function _handleRequest(resolve, reject) {
        debug(`${options.method} ${options.hostname}:${options.port}${options.path}`);

        if (data && HTTP_DATA_METHODS.includes(options.method)) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(options);

        req.on('response', (response) => {
            setImmediate(handleResponse, response, resolve, reject);
        });

        req.on('timeout', () => {
            req.abort();
        });

        req.on('error', (err) => {
            setImmediate(() => {
                let result;

                if (~err.message.indexOf('ECONNREFUSED')) {
                    result = new HTTPConnectionError('Error connecting to remote server');
                    result.status = 500;
                    result.detail = `Error connecting to ${options.host}`;
                } else {
                    result = new HTTPError(err.message);
                    result.status = err.status;
                }

                result.original = err;
                reject(result);
            });
        });

        if (data && HTTP_DATA_METHODS.includes(options.method)) {
            process.nextTick(() => {
                if (isStream(data)) {
                    data.on('end', () => {
                        req.end();
                    });

                    data.pipe(req, {end: true});
                } else {
                    req.write(data, () => {
                        req.end();
                    });
                }
            });
        } else {
            req.end();
        }
    }

    return new Future(_handleRequest);
}

/**
 * Perform a GET request.
 * @param  {String} url     The URL to connect to.
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
module.exports.get = async function (url, options = {}) {
    const Future = options.Future || Promise;

    async function _inner(url, reqAgent, followed = 0) {
        let error;

        const follow = reqAgent.followRedirects;
        const maxFollows = reqAgent.maxRedirects;

        if (follow) {
            const resp = await _request({
                http: reqAgent.http,
                options: reqAgent.httpOptions, Future: Future
            });

            if (resp instanceof HTTPRedirect) {
                if (followed >= maxFollows) {
                    error = new HTTPError(500);
                    error.message = 'Maximum number of redirects reached';
                    return Future.reject(error);
                }

                if (hasHeader('location', resp.headers)) {
                    const [oldUrl, newUrl] = reqAgent.toURLs(
                        url, resp.headers.location);

                    reqAgent.update(oldUrl, newUrl);

                    return _inner(newUrl, reqAgent, followed + 1);
                }
            } else if (resp instanceof HTTPResponse) {
                return Future.resolve(resp);
            } else {
                return Future.reject(resp);
            }
        } else {
            return _request({
                http: reqAgent.http,
                options: reqAgent.httpOptions, Future: Future
            });
        }
    }

    if (options.method !== 'GET') {
        options.method = 'GET';
    }

    const reqAgent = agent.create(url, options);

    return _inner(url, reqAgent);
};

/**
 *
 * @param {String} url
 * @param {Buffer} data
 * @param {Object} options
 * @returns {Promise}
 */
function _dataRequest(url, data, options) {
    const Future = options.Future || Promise;

    const requestAgent = agent.create(url, options);

    return _request({
        http: requestAgent.http,
        options: requestAgent.httpOptions,
        data: data, Future: Future
    });
}

/**
 * Perform a POST request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @returns {Promise}
 */
module.exports.post = function (url, data, options = {}) {
    if (options.method !== 'POST') {
        options.method = 'POST';
    }

    return _dataRequest(url, data, options);
};

/**
 * Perform a PUT request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @returns {Promise}
 */
module.exports.put = function (url, data, options = {}) {
    if (options.method !== 'PUT') {
        options.method = 'PUT';
    }

    return _dataRequest(url, data, options);
};

/**
 * Perform a PATCH request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @returns {Promise}
 */
module.exports.patch = function (url, data, options = {}) {
    if (options.method !== 'PATCH') {
        options.method = 'PATCH';
    }

    return _dataRequest(url, data, options);
};

/**
 * Perform a DELETE request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Object} options Options for the HTTP agent and connection.
 * @returns {Promise}
 */
module.exports.delete = function (url, options = {}) {
    const Future = options.Future || Promise;

    if (options.method !== 'DELETE') {
        options.method = 'DELETE';
    }

    const requestAgent = agent.create(url, options);

    return _request({
        http: requestAgent.http,
        options: requestAgent.httpOptions,
        Future: Future
    });
};

module.exports.queryfy = utils.queryfy;
module.exports.errors = require('./lib/errors');
