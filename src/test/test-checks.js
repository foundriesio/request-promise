const assert = require('assert');

const {isObject, isString} = require('../lib/checks');

describe('Test the checks functions', () => {
    process.env.NODE_ENV = 'test';

    it('isObject should always return false', () => {
        assert.strictEqual(isObject(''), false);
        assert.strictEqual(isObject('foo'), false);
        assert.strictEqual(isObject('àèìòùåß∂ƒ∫'), false);
        assert.strictEqual(isObject(2), false);
        assert.strictEqual(isObject([]), false);
        assert.strictEqual(isObject(function() {}), false);
    });

    it('isObject should always return true', () => {
        assert.strictEqual(isObject({}), true);
    });

    it('isString should always return false', () => {
        assert.strictEqual(isString(), false);
        assert.strictEqual(isString(null), false);
        assert.strictEqual(isString(1), false);
        assert.strictEqual(isString([]), false);
        assert.strictEqual(isString({}), false);
        assert.strictEqual(isString(() => {}), false);
    });

    it('isString should always return true', () => {
        assert.strictEqual(isString('foobar'), true);
        assert.strictEqual(isString('àèìòùåß∂ƒ∫'), true);
    });
});
