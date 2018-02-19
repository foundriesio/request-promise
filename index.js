const debug = require('debug')('request-promise');
const isStream = require('is-stream');
const zlib = require('zlib');

const agent = require('./lib/agent');
const utils = require('./lib/utils');
const {HTTPError, HTTPConnectionError} = require('./lib/errors');
const {HTTPResponse, HTTPRedirect} = require('./lib/response');
const {isNull, isObject} = require('./lib/checks');

// List of HTTP verbs that support sending data.
const HTTP_DATA_METHODS = [
    'PATCH',
    'POST',
    'PUT'
];

const PROMISE_LIBS = {};

function _checkPromiseLib(options) {
    if (isObject(options) && !isNull(options.promise)) {
        const name = options.promise;
        if (PROMISE_LIBS[name] === undefined) {
            try {
                require.resolve(name);
                PROMISE_LIBS[name] = require(name);
            } catch (_) {
                return Promise;
            }
        }

        return PROMISE_LIBS[name];
    } else {
        return Promise;
    }
}

/**
 * Check if the headers object contains a specific header.
 * @param  {String}  value   The name of the header to check.
 * @param  {Object}  headers The object containing all the headers.
 * @return {Boolean}         If the header is available and not null.
 */
function hasHeader(value, headers) {
    if (isObject(headers) && headers.hasOwnProperty(value.toLowerCase())) {
        return true;
    }
    return false;
}

function handleResponse(response, resolve, reject) {
    let deCompressor;
    let output;
    let result;

    const data = [];

    response.on('error', reject);

    switch (response.headers['content-encoding']) {
        case 'gzip':
            output = deCompressor = zlib.createGunzip();
            response.pipe(deCompressor);
            break;
        case 'deflate':
            output = deCompressor = zlib.createInflate();
            response.pipe(deCompressor);
            break;
        default:
            output = response;
    }

    output.on('data', (chunck) => {
        data.push(chunck);
    });

    output.on('end', () => {
        const status = response.statusCode;

        if (status > 300 && status <= 310) {
            result = new HTTPRedirect('Redirect');
            result.location = response.headers.location;
        } else if (status < 200 || status > 310) {
            result = new HTTPError('HTTP error');
        } else {
            result = new HTTPResponse('OK');
        }

        result.status = status;

        if (hasHeader('content-type', response.headers) &&
                response.headers['content-type'].includes('json')) {
            result.body = JSON.parse(Buffer.concat(data).toString('utf8'));
        } else {
            result.body = Buffer.concat(data);
        }

        result.headers = response.headers;

        resolve(result);
    });
}

/**
 * The internal request method that performs the actual HTTP operation.
 *
 * @param  {HTTP} http      The HTTP client.
 * @param  {Object} options The HTTP options.
 * @param  {Object} data    If a POST  request, the data to write.
 * @param  {Object} Future  The Promise object/library to use.
 * @return {Promise}
 */
function _request(http, options, data, Future) {
    if (arguments.length === 3) {
        Future = data;
    }

    return new Future((resolve, reject) => {
        let req;
        let result;

        debug(`${options.method} ${options.host}:${options.port}${options.path}`);

        req = http.request(options);

        req.on('response', (response) => {
            handleResponse(response, resolve, reject);
        });

        req.on('timeout', () => {
            req.abort();
        });

        req.on('error', (err) => {
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

        if (data && HTTP_DATA_METHODS.includes(options.method)) {
            if (isStream(data)) {
                data.pipe(req);
            } else {
                req.write(data);
            }
        }

        req.end();
    });
}

/**
 * Perform a GET request.
 * @param  {String} url     The URL to connect to.
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
function _get(url, options) {
    const Future = _checkPromiseLib(options);

    return new Future((resolve, reject) => {
        let follow;
        let maxFollows;
        let requestAgent;

        function _innerget(oldUrl, followed) {
            let newUrl;
            let error;

            _request(requestAgent.http, requestAgent.httpOptions, Future)
                .then((response) => {
                    if (response instanceof HTTPRedirect && follow) {
                        if (followed < maxFollows) {
                            if (hasHeader('location', response.headers)) {
                                newUrl = requestAgent.update(oldUrl, response.headers.location);
                                _innerget(newUrl, followed + 1);
                            } else {
                                error = new HTTPError(400);
                                error.message = 'Cannot follow redirect: missing Location header';
                                reject(error);
                            }
                        } else {
                            error = new HTTPError(500);
                            error.message = 'Maximum number of redirects reached';
                            reject(error);
                        }
                    } else if (response instanceof HTTPRedirect && !follow) {
                        resolve(response);
                    } else if (response instanceof HTTPError) {
                        reject(response);
                    } else {
                        resolve(response);
                    }
                    // Silence the Promise warning since we are calling a new
                    // Promise-function inside another one and not resolving
                    // the old one.
                    return null;
                })
                .catch((err) => {
                    reject(err);
                });
        }

        requestAgent = agent.create(url, options);

        follow = requestAgent.followRedirects;

        if (follow) {
            maxFollows = requestAgent.maxRedirects;
        }

        _innerget(url, 0);
    });
}

/**
 * Perform a POST request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
function _post(url, data, options) {
    const Future = _checkPromiseLib(options);

    return new Future((resolve, reject) => {
        let requestAgent;

        if (isObject(options)) {
            if (options.method !== 'POST') {
                options.method = 'POST';
            }
        } else {
            options = {
                method: 'POST'
            };
        }

        requestAgent = agent.create(url, options);

        _request(requestAgent.http, requestAgent.httpOptions, data, Future)
            .then((result) => {
                if (result instanceof HTTPResponse) {
                    resolve(result);
                } else {
                    reject(result);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}

/**
 * Perform a PUT request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
function _put(url, data, options) {
    const Future = _checkPromiseLib(options);

    return new Future((resolve, reject) => {
        let requestAgent;

        if (isObject(options)) {
            if (options.method !== 'PUT') {
                options.method = 'PUT';
            }
        } else {
            options = {
                method: 'PUT'
            };
        }

        requestAgent = agent.create(url, options);

        _request(requestAgent.http, requestAgent.httpOptions, data, Future)
            .then((result) => {
                if (result instanceof HTTPResponse) {
                    resolve(result);
                } else {
                    reject(result);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}

/**
 * Perform a PATCH request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
function _patch(url, data, options) {
    const Future = _checkPromiseLib(options);

    return new Future((resolve, reject) => {
        let requestAgent;

        if (isObject(options)) {
            if (options.method !== 'PATCH') {
                options.method = 'PATCH';
            }
        } else {
            options = {
                method: 'PATCH'
            };
        }

        requestAgent = agent.create(url, options);

        _request(requestAgent.http, requestAgent.httpOptions, data, Future)
            .then((result) => {
                if (result instanceof HTTPResponse) {
                    resolve(result);
                } else {
                    reject(result);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}

/**
 * Perform a DELETE request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
function _delete(url, options) {
    const Future = _checkPromiseLib(options);

    return new Future((resolve, reject) => {
        let requestAgent;

        if (isObject(options)) {
            if (options.method !== 'DELETE') {
                options.method = 'DELETE';
            }
        } else {
            options = {
                method: 'DELETE'
            };
        }

        requestAgent = agent.create(url, options);

        _request(requestAgent.http, requestAgent.httpOptions, Future)
            .then((result) => {
                if (result instanceof HTTPResponse) {
                    resolve(result);
                } else {
                    reject(result);
                }
            })
            .catch((error) => {
                reject(error);
            });
    });
}

module.exports = {
    get: _get,
    post: _post,
    delete: _delete,
    patch: _patch,
    put: _put,
    queryfy: utils.queryfy,
    errors: require('./lib/errors')
};
