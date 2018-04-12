function isObject(val) {
    if (val != null && val.constructor === Object) {
        return true;
    }

    return false;
}

function isString(val) {
    if (val != null && (typeof val === 'string' || val instanceof String)) {
        return true;
    }

    return false;
}

module.exports = {
    isObject: isObject,
    isString: isString
};
