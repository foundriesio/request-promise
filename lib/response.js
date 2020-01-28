/**
 * An HTTP response response object.
 *
 * Used to provide a wrapper around the response from HTTP request.
 */
class HTTPResponse {
  constructor(message) {
    this.message = message;
    this.name = 'HTTP Response';
    this.statusCode = 200;

    this.body;
    this.headers;
    this.httpVersion;
    this.location;
    this.rawHeaders;
    this.stausMessage;
  }

  json() {
    if (this.body && Buffer.byteLength(this.body) > 0) {
      return JSON.parse(this.body);
    }
  }

  text() {
    if (this.body && Buffer.byteLength(this.body) > 0) {
      return this.body.toString();
    }
  }

  contentType() {
    if (this.headers
        && Object.prototype.hasOwnProperty.call(this.headers, 'content-type')) {
      return this.headers['content-type'];
    }
  }
}

/**
 * An HTTP redirect response object.
 *
 * Used to provide a wrapper for HTTP redirects.
 */
class HTTPRedirect extends HTTPResponse {
  constructor(message) {
    super(message);
    this.name = 'HTTP Redirect Response';
    this.statusCode = 301;
  }
}

module.exports = {
  HTTPRedirect: HTTPRedirect,
  HTTPResponse: HTTPResponse
};
