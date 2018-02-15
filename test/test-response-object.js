const assert = require('assert');

const {HTTPResponse, HTTPRedirect} = require('../lib/response');

describe('Test the HTTResponse/HTTPRedirect objects', () => {
    process.env.NODE_ENV = 'test';

    it('Should have a defined set of enumerable properties', () => {
        const expected = [
            'body',
            'location',
            'message',
            'name',
            'status'
        ];

        assert.deepStrictEqual(Object.keys(new HTTPResponse()).sort(), expected);
    });

    it('Default values should be set (HTTPResponse)', () => {
        const response = new HTTPResponse();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.name, 'HTTP Response');
        assert.strictEqual(response.message, undefined);
        assert.strictEqual(response.body, undefined);
        assert.strictEqual(response.location, undefined);
        assert.strictEqual(response.headers, undefined);
    });

    it('Default values should be set (HTTPRedirect)', () => {
        const response = new HTTPRedirect();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.name, 'HTTP Redirect Response');
        assert.strictEqual(response.message, undefined);
        assert.strictEqual(response.body, undefined);
        assert.strictEqual(response.location, undefined);
        assert.strictEqual(response.headers, undefined);
    });

    it('Should set a different message', () => {
        const response = new HTTPResponse();
        response.message = 'message';

        assert.equal(response.message, 'message');
    });

    it('Should set a different status', () => {
        const response = new HTTPResponse();
        response.status = 299;

        assert.equal(response.status, 299);
    });

    it('Should set a different body', () => {
        const response = new HTTPResponse();
        response.body = 'body';

        assert.equal(response.body, 'body');
    });

    it('Headers must be an object', () => {
        const response = new HTTPResponse();

        assert.throws(() => {
            response.headers = 'headers';
        }, TypeError);

        assert.throws(() => {
            response.headers = () => {
                return 'headers';
            };
        }, TypeError);

        assert.throws(() => {
            response.headers = ['header'];
        }, TypeError);
    });

    it('Should set different headers', () => {
        const response = new HTTPResponse();

        response.headers = {
            'X-Header': 'value'
        };

        assert.deepStrictEqual(response.headers, {'X-Header': 'value'});
    });
});
