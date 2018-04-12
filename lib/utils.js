const {isObject} = require('./checks');

/**
 * Transform an object into a query string.
 *
 * It accepts an Object, an Array or a String.
 * If it is a String, it will be returned as an encodeURI-string.
 * If it is an Array, its values are just concatenated together.
 * If it is an Object it will be transformed into a String following the logic
 * below.
 *
 * @param  {Object} query The object containing the query parameters.
 * @return {String} The query string, or an empty string.
 */
function queryfy(query) {
    function queryfyObject(obj) {
        const queryArray = [];

        function parse(key, data, prevKey) {
            let qk = key;

            if (prevKey) {
                qk = `${prevKey}[${key}]`;
            }

            if (isObject(data)) {
                // Only works with 1 level of nested object.
                Object.entries(data).forEach(([sk, sd]) => {
                    if (sd != null) {
                        parse(sk, sd, qk);
                    }
                });
            } else if (Array.isArray(data)) {
                // If it is an array, for each value create a new query
                // parameter: key: [val1, val2, ...] -> key=val1 key=val2 ...
                data.forEach((datum) => {
                    if (datum != null) {
                        queryArray.push(`${qk}=${encodeURIComponent(datum)}`);
                    }
                });
            } else if (data != null) {
                // If it is a string, just do key=val.
                queryArray.push(`${qk}=${encodeURIComponent(data)}`);
            }
        } // end-fn parse

        Object.entries(obj).forEach(([key, val]) => {
            if (val != null) {
                parse(key, val);
            }
        });

        return queryArray;
    } // end-fn queryfyObject

    if (isObject(query)) {
        return queryfyObject(query).join('&');
    } else if (Array.isArray(query)) {
        return query.join('&');
    } else if (query != null) {
        return encodeURI(query);
    } else {
        return '';
    }
}

module.exports = {
    queryfy: queryfy
};
