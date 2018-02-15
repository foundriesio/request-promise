const {isNull} = require('./checks');

/**
 * An HTTP response response object.
 *
 * Used to provide a wrapper around the response from HTTP request.
 */
class HTTPResponse {
    constructor(message) {
        this.body = undefined;
        this.location = undefined;
        this.message = message;
        this.name = 'HTTP Response';
        this.status = 200;
    }
}

Object.defineProperty(HTTPResponse.prototype, 'headers', {
    get: function() {
        return this._headers;
    },
    set: function(val) {
        if (isNull(val) || val.constructor === Object) {
            this._headers = val;
        } else {
            throw TypeError('Headers must be an object');
        }
    },
    configurable: true,
    enumerable: true
});

/**
 * An HTTP redirect response object.
 *
 * Used to provide a wrapper for HTTP redirects.
 */
class HTTPRedirect extends HTTPResponse {
    constructor(message) {
        super(message);
        this.name = 'HTTP Redirect Response';
    }
}

module.exports = {
    HTTPRedirect: HTTPRedirect,
    HTTPResponse: HTTPResponse
};
