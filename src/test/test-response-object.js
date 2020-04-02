const assert = require('assert');

const {HTTPResponse, HTTPRedirect} = require('../lib/response');

describe('Test the HTTResponse/HTTPRedirect objects', () => {
    process.env.NODE_ENV = 'test';

    it('Should have a defined set of enumerable properties', () => {
        const expected = [
            'body',
            'headers',
            'httpVersion',
            'location',
            'message',
            'name',
            'rawHeaders',
            'statusCode',
            'statusMessage'
        ];

        assert.deepStrictEqual(Object.keys(new HTTPResponse()).sort(), expected);
    });

    it('Default values should be set (HTTPResponse)', () => {
        const response = new HTTPResponse();

        assert.strictEqual(response.statusCode, 200);
        assert.strictEqual(response.name, 'HTTP Response');
        assert.strictEqual(response.message, undefined);
        assert.strictEqual(response.body, null);
        assert.strictEqual(response.location, null);
        assert.strictEqual(response.headers, null);
    });

    it('Default values should be set (HTTPRedirect)', () => {
        const response = new HTTPRedirect();

        assert.strictEqual(response.statusCode, 301);
        assert.strictEqual(response.name, 'HTTP Redirect Response');
        assert.strictEqual(response.message, undefined);
        assert.strictEqual(response.body, null);
        assert.strictEqual(response.location, null);
        assert.strictEqual(response.headers, null);
    });

    it('Should set a different message', () => {
        const response = new HTTPResponse();
        response.message = 'message';

        assert.equal(response.message, 'message');
    });

    it('Should set a different status', () => {
        const response = new HTTPResponse();
        response.statusCode = 299;

        assert.equal(response.statusCode, 299);
    });

    it('Should set a different body', () => {
        const response = new HTTPResponse();
        response.body = 'body';

        assert.equal(response.body, 'body');
    });

    it('Should set different headers', () => {
        const response = new HTTPResponse();

        response.headers = {
            'X-Header': 'value'
        };

        assert.deepStrictEqual(response.headers, {'X-Header': 'value'});
    });
});
