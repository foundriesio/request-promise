class RequestError extends Error {
    constructor(message) {
        super(message);
        this.detail = undefined;
        this.error = undefined;
        this.name = 'Request Error';
        this.statusCode = 400;

        this.body = null;
        this.headers = null;
        this.httpVersion = '1.1';
        this.location = null;
        this.rawHeaders = null;
        this.statusMessage = null;
    }
}

class RequestAgentError extends RequestError {
    constructor(message) {
        super(message);
        this.name = 'HTTP Agent Error';
        this.statusCode = 500;
    }
}

class HTTPError extends RequestError {
    constructor(message) {
        super(message);
        this.name = 'HTTP Error';
        this.original = undefined;
    }
}

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
