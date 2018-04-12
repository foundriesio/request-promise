class RequestError extends Error {
    constructor(message) {
        super(message);
        this.detail = undefined;
        this.error = undefined;
        this.name = 'Request Error';
        this.status = 400;
    }
}

class RequestAgentError extends RequestError {
    constructor(message) {
        super(message);
        this.name = 'HTTP Agent Error';
        this.status = 500;
    }
}

class HTTPError extends RequestError {
    constructor(message) {
        super(message);
        this.body = undefined;
        this.headers = undefined;
        this.name = 'HTTP Error';
        this.original = undefined;
    }
}

Object.defineProperty(HTTPError.prototype, 'headers', {
    get: function() {
        return this._headers;
    },
    set: function(val) {
        if (val == null || val.constructor === Object) {
            this._headers = val;
        } else {
            throw TypeError('Headers must be an object');
        }
    },
    configurable: true,
    enumerable: true
});

class HTTPConnectionError extends HTTPError {
    constructor(message) {
        super(message);
        this.name = 'HTTP Connection Error';
    }
}

module.exports = {
    HTTPConnectionError: HTTPConnectionError,
    HTTPError: HTTPError,
    RequestAgentError: RequestAgentError
};
