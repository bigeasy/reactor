// Node.js API.
var http = require('http')

module.exports =  function (vargs) {
    var length = vargs.length
    var statusCode = typeof vargs[0] == 'number'
                   ? vargs.shift()
                   : 200
    var description = http.STATUS_CODES[statusCode] || 'Unknown'
    if (typeof vargs[0] == 'string' && length > 1) {
        description = vargs.shift()
    } else if (vargs.length > 1 && vargs[0] == null) {
        vargs.shift()
    }
    var headers = length > 1 && vargs.length && typeof vargs[0] == 'object'
                ? vargs.shift() : {}
    if (Array.isArray(headers)) {
        headers = headers.reduce(function (headers, header) {
            var $ = /^(.*?)\s*:\s*(.*)$/.exec(header)
            if ($ != null) {
                headers[$[1]] = $[2]
            }
            return headers
        }, {})
    }
    var body = vargs.length == 0 ? description : vargs.shift()
    return {
        statusCode: statusCode,
        description: description,
        headers: headers,
        body: body
    }
}
