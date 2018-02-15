const assert = require('assert');

const {queryfy} = require('../lib/utils');

describe('Test the utils functions', () => {
    process.env.NODE_ENV = 'test';

    it('queryfy should return a string', () => {
        assert.strictEqual(queryfy(), '');
        assert.strictEqual(queryfy(null), '');
        assert.strictEqual(queryfy(''), '');
        assert.strictEqual(queryfy([]), '');
        assert.strictEqual(queryfy({}), '');
        assert.strictEqual(queryfy('foo=bar&bar=foo+bar'), 'foo=bar&bar=foo+bar');
        assert.strictEqual(queryfy(['foo', 'bar']), 'foo&bar');
        assert.strictEqual(queryfy({foo: 'bar'}), 'foo=bar');
        assert.strictEqual(queryfy({bar: [1, 2,]}), 'bar=1&bar=2');
        assert.strictEqual(queryfy({bar: {foo: 1, foobar: 2}}), 'bar[foo]=1&bar[foobar]=2');
        assert.strictEqual(queryfy({bar: {foo: [1, 2]}}), 'bar[foo]=1&bar[foo]=2');
        assert.strictEqual(queryfy({bar: {foo: {baz: [1, 2]}}}), 'bar[foo][baz]=1&bar[foo][baz]=2');
    });
});
