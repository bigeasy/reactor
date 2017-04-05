var cadence = require('cadence')
var dispatch = require('dispatch')
var interrupt = require('interrupt').createInterrupter('reactor')
var Operation = require('operation/variadic')
var Turnstile = require('turnstile/redux')
var rescue = require('rescue')
var delta = require('delta')
var coalesce = require('extant')
var nop = require('nop')

function Constructor (object, dispatch) {
    this._object = object
    this._dispatch = dispatch
}

Constructor.prototype.dispatch = function () {
    var vargs = Array.prototype.slice.call(arguments)
    this._dispatch[vargs.shift()] = Operation(vargs, { object: this._object })
}

function handle (turnstile, operation) {
    var before = require('connect')()
        .use(require('express-auth-parser'))
    // TODO Configurable.
        .use(require('body-parser').urlencoded({ extended: false, limit: '64mb' }))
        .use(require('body-parser').json({ limit: '64mb' }))
    return function (request, response, next) {
        var vargs = Array.prototype.slice.call(arguments, 3)
        before(request, response, function (error) {
            if (error) {
                next(error)
            } else {
                turnstile.push({
                    operation: operation,
                    request: request,
                    response: response,
                    vargs: vargs,
                    next: next
                })
            }
        })
    }
}


function Reactor (object, configurator) {
    var constructor = new Constructor(object, this._dispatch = {})
    configurator(constructor)
    this.turnstile = new Turnstile(this, '_respond', {
        Date: coalesce(constructor.Date, Date),
        turnstiles: coalesce(constructor.turnstiles, 24),
        timeout: coalesce(constructor.timeout)
    })
    this._logger = coalesce(constructor.logger, nop)
    this._object = object
    for (var pattern in this._dispatch) {
        this._dispatch[pattern] = handle(this.turnstile, this._dispatch[pattern])
    }
    this.middleware = require('connect')().use(dispatch(this._dispatch))
}

Reactor.prototype._timeout = cadence(function (async, request) {
    request.raise(503, 'Service Not Available')
})

function createProperties (properties) {
    return {
        statusCode: properties.statusCode,
        headers: properties.headers || {},
        description: properties.description || 'Unknown'
    }
}

function raise (statusCode, description, headers) {
    throw interrupt('http', createProperties({
        statusCode: statusCode,
        description: description,
        headers: headers
    }))
}

Reactor.prototype._respond = cadence(function (async, envelope) {
    var work = envelope.body
    var next = work.next
    var entry = {
        turnstile: this.turnstile.health,
        statusCode: 200,
        request: {
            method: work.request.method,
            header: work.request.headers,
            url: work.request.url
        }
    }

    work.request.raise = raise

    if (envelope.timedout) {
        work.operation = Operation([ this, '_timeout' ])
    }

    var block = async([function () {
        async(function () {
            async([function () {
                work.operation.apply(null, [ work.request ].concat(work.vargs, async()))
            }, function (error) {
                for (;;) {
                    try {
                        return rescue(/^reactor#http$/m, function (error) {
                            var statusCode = entry.statusCode = error.statusCode
                            var description = entry.description = error.description
                            var headers = error.headers
                            var body = new Buffer(JSON.stringify({ description: description }) + '\n')
                            headers['content-length'] = body.length
                            headers['content-type'] = 'application/json'
                            work.response.writeHead(statusCode, description, headers)
                            work.response.end(body)
                            return [ block.break ]
                        })(error)
                    } catch (ignore) {
                        if (
                            typeof error == 'number' &&
                            !isNaN(error) &&
                            (error | 0) === error &&
                            Math.floor(error / 100) <= 5 &&
                            Math.floor(error / 100) >= 3
                        ) {
                            error = { statusCode: error }
                        } else if (typeof error == 'string') {
                            error = { statusCode: 307, location: error }
                        }
                        if (
                            typeof error == 'object' &&
                            typeof error.statusCode == 'number' &&
                            !isNaN(error.statusCode) &&
                            (error.statusCode | 0) === error.statusCode &&
                            Math.floor(error.statusCode / 100) <= 5 &&
                            Math.floor(error.statusCode / 100) >= 3
                        ) {
                            var properties = createProperties(error)
                            if (error.location) {
                                properties.headers.location = error.location
                            }
                            error = interrupt('http', properties)
                        } else {
                            throw error
                        }
                    }
                }
            }])
        }, function (result, headers) {
            headers || (headers = {})
            var body
            switch (typeof result) {
            case 'function':
                async(function () {
                    delta(async()).ee(work.response).on('finish')
                    if (result.length == 2) {
                        result.call(work.operation.object, work.response, async())
                    } else {
                        result.call(work.operation.object, work.response)
                    }
                }, function () {
                    return []
                })
                return
            case 'string':
                body = new Buffer(result)
                break
            default:
                headers['content-type'] = 'application/json'
                body = new Buffer(JSON.stringify(result) + '\n')
                break
            }
            headers['content-length'] = body.length
            work.response.writeHead(200, 'OK', headers)
            work.response.end(body)
        })
    }, function (error) {
        entry.statusCode = 0
        entry.stack = error.stack
        next(error)
    }], function () {
        this._logger('info', 'request', entry)
        return [ block.break ]
    })()
})

Reactor.resend = function (statusCode, headers, body) {
    return function (response) {
        var h = {
            'content-type': headers['content-type'],
            'content-length': body.length
        }
        response.writeHead(statusCode, h)
        response.end(body)
    }
}

module.exports = Reactor
