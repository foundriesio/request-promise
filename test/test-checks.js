const assert = require('assert');

const {isNull, isObject, isString} = require('../lib/checks');

describe('Test the checks functions', () => {
    process.env.NODE_ENV = 'test';

    it('isNull should always return false', () => {
        assert.strictEqual(isNull(''), false);
        assert.strictEqual(isNull('foo'), false);
        assert.strictEqual(isNull('àèìòùåß∂ƒ∫'), false);
        assert.strictEqual(isNull(2), false);
        assert.strictEqual(isNull([]), false);
        assert.strictEqual(isNull({}), false);
        assert.strictEqual(isNull(function() {}), false);
    });

    it('isNull should always return true', () => {
        assert.strictEqual(isNull(null), true);
        assert.strictEqual(isNull(undefined), true);
        assert.strictEqual(isNull([][0]), true);
        assert.strictEqual(isNull({}.foo), true);
    });

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
