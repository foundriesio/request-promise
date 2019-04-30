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
    if (headers.hasOwnProperty(value.toLowerCase())) {
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
        setImmediate(() => {
            const status = response.statusCode;

            if (status >= 200 && status < 300) {
                result = new HTTPResponse('OK');
            } else if (status >= 300 && status <= 310) {
                result = new HTTPRedirect('Redirect');
                result.location = response.headers.location;
            } else {
                result = new HTTPError('HTTP error');
            }

            result.status = status;

            if (hasHeader('content-type', response.headers) &&
                    /json/.test(response.headers['content-type'])) {
                result.body = JSON.parse(Buffer.concat(data).toString('utf8'));
            } else {
                result.body = Buffer.concat(data);
            }

            result.headers = response.headers;

            resolve(result);
        });
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
async function _get(url, options = {}) {
    const Future = options.Future || Promise;

    async function _inner(url, reqAgent, followed = 0) {
        let error;

        const follow = reqAgent.followRedirects;
        const maxFollows = reqAgent.maxRedirects;

        const resp = await _request({
            http: reqAgent.http,
            options: reqAgent.httpOptions, Future: Future});

        if (resp instanceof HTTPResponse) {
            return resp;
        } else if (resp instanceof HTTPRedirect && follow) {
            if (followed < maxFollows) {
                if (hasHeader('location', resp.headers)) {
                    const [oldUrl, newUrl] = reqAgent.toURLs(
                        url, resp.headers.location);

                    await reqAgent.update(oldUrl, newUrl);

                    return _inner(newUrl, reqAgent, followed + 1);
                } else {
                    error = new HTTPError(400);
                    error.message = 'Missing Location header';
                    throw error;
                }
            } else {
                error = new HTTPError(500);
                error.message = 'Maximum number of redirects reached';
                throw error;
            }
        } else if (resp instanceof HTTPRedirect && !follow) {
            return resp;
        } else {
            throw resp;
        }
    }

    if (options.method !== 'GET') {
        options.method = 'GET';
    }

    const reqAgent = await agent.create(url, options);

    return _inner(url, reqAgent);
}

async function _dataRequest(url, data, options) {
    const Future = options.Future || Promise;

    const requestAgent = await agent.create(url, options);

    try {
        const resp = await _request({
            http: requestAgent.http,
            options: requestAgent.httpOptions,
            data: data, Future: Future
        });

        if (resp instanceof HTTPResponse) {
            return resp;
        } else {
            throw resp;
        }
    } catch (err) {
        throw err;
    }
}

/**
 * Perform a POST request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
async function _post(url, data, options = {}) {
    if (options.method !== 'POST') {
        options.method = 'POST';
    }

    return _dataRequest(url, data, options);
}

/**
 * Perform a PUT request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
async function _put(url, data, options = {}) {
    if (options.method !== 'PUT') {
        options.method = 'PUT';
    }

    return _dataRequest(url, data, options);
}

/**
 * Perform a PATCH request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Buffer} data    The data to send (String or Buffer).
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
async function _patch(url, data, options = {}) {
    if (options.method !== 'PATCH') {
        options.method = 'PATCH';
    }

    return _dataRequest(url, data, options);
}

/**
 * Perform a DELETE request.
 *
 * @param  {String} url     The URL to connect to.
 * @param  {Object} options Options for the HTTP agent and connection.
 * @return {Promise}
 */
async function _delete(url, options = {}) {
    const Future = options.Future || Promise;

    if (options.method !== 'DELETE') {
        options.method = 'DELETE';
    }

    const requestAgent = await agent.create(url, options);

    try {
        const resp = await _request({
            http: requestAgent.http,
            options: requestAgent.httpOptions,
            Future: Future});

        if (resp instanceof HTTPResponse) {
            return resp;
        } else {
            throw resp;
        }
    } catch (err) {
        throw err;
    }
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
