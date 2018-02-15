function isNull(val) {
    if (val === undefined || val === null) {
        return true;
    }
    return false;
}

function isObject(val) {
    if (!isNull(val) && val.constructor === Object) {
        return true;
    }
    return false;
}

function isString(val) {
    if (!isNull(val) && (typeof val === 'string' || val instanceof String)) {
        return true;
    }
    return false;
}

module.exports = {
    isNull: isNull,
    isObject: isObject,
    isString: isString
};
