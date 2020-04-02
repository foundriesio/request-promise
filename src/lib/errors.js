export class RequestError extends Error {
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

export class HTTPError extends RequestError {
  constructor(message) {
    super(message);
    this.name = 'HTTP Error';
    this.original = undefined;
  }
}
