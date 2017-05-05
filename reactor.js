var cadence = require('cadence')
var dispatch = require('dispatch')
var interrupt = require('interrupt').createInterrupter('reactor')
var Operation = require('operation/variadic')
var Turnstile = require('turnstile')
Turnstile.Queue = require('turnstile/queue')
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

function middlewareConstructor (queue, operation) {
    return function (before) {
        return function (request, response, next) {
            var vargs = Array.prototype.slice.call(arguments, 3)
            before(request, response, function (error) {
                if (error) {
                    next(error)
                } else {
                    request.entry = {
                        when: {
                            push: Date.now(),
                            work: null,
                            done: null
                        },
                        health: {
                            push: JSON.parse(JSON.stringify(queue.turnstile.health)),
                            work: null,
                            done: null
                        },
                        request: {
                            method: request.method,
                            header: request.headers,
                            url: request.url
                        }
                    }
                    queue.push({
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
}

function injectParsers (handler) {
    var before = require('connect')()
        .use(require('express-auth-parser'))
    // TODO Configurable.
        .use(require('body-parser').urlencoded({ extended: false, limit: '64mb' }))
        .use(require('body-parser').json({ limit: '64mb' }))
    return handler(before)
}

function handle (queue, operation) {
}

function Reactor (object, configurator) {
    var constructor = new Constructor(object, this._dispatch = {})
    configurator(constructor)
    this.turnstile = new Turnstile({
        Date: coalesce(constructor.Date, Date),
        turnstiles: coalesce(constructor.turnstiles, 24),
        timeout: coalesce(constructor.timeout)
    })
    this._queue = new Turnstile.Queue(this, '_respond', this.turnstile)
    this._logger = coalesce(constructor.logger, nop)
    this._object = object
    var middleware = {}
    var dispatcher = {}
    for (var pattern in this._dispatch) {
        var create = middlewareConstructor(this._queue, this._dispatch[pattern])
        dispatcher[pattern] = create(function (request, response, next) { next() })
        middleware[pattern] = injectParsers(create)
    }
    this.middleware = require('connect')().use(dispatch(middleware))
    this.dispatcher = require('connect')().use(dispatch(dispatcher))
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

    var entry = work.request.entry

    entry.when.work = Date.now()
    entry.health.work = JSON.parse(JSON.stringify(this.turnstile.health))

    work.request.entry = entry
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
                            delta(async()).ee(work.response).on('finish')
                            var statusCode = entry.statusCode = error.statusCode
                            var description = entry.description = error.description
                            var headers = error.headers
                            var body = new Buffer(JSON.stringify({ description: description }) + '\n')
                            headers['content-length'] = body.length
                            headers['content-type'] = 'application/json'
                            entry.statusCode = statusCode
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
                headers['content-type'] = 'text/plain'
                body = new Buffer(result)
                break
            default:
                headers['content-type'] = 'application/json'
                body = new Buffer(JSON.stringify(result) + '\n')
                break
            }
            headers['content-length'] = body.length
            delta(async()).ee(work.response).on('finish')
            entry.statusCode = 200
            work.response.writeHead(200, 'OK', headers)
            work.response.write(body)
            work.response.end()
        })
    }, function (error) {
        entry.statusCode = 599
        entry.stack = error.stack
        next(error)
    }], function () {
        entry.health.done = JSON.parse(JSON.stringify(this.turnstile.health))
        entry.when.done = Date.now()
        this._logger('info', 'request', entry)
        return [ block.break ]
    })()
})

Reactor.resend = function (statusCode, headers, body) {
    return Reactor.send({ statusCode: statusCode, headers: headers }, body)
}

Reactor.send = function (properties, buffer) {
    return function (response) {
        response.statusCode = properties.statusCode
        response.statusMessage = coalesce(properties.statusMessage)
        response.setHeader('content-length', String(buffer.length))
        for (var name in properties.headers) {
            if (name != 'content-length' && name != 'transfer-encoding') {
                response.setHeader(name, properties.headers[name])
            }
        }
        response.write(buffer)
        response.end()
    }
}

Reactor.string = function (contentType, text) {
    return function (response) {
        var buffer = new Buffer(text)
        response.writeHead(statusCode, {
            'content-type': contentType,
            'content-length': buffer.length
        })
        response.end(buffer)
    }
}

Reactor.stream = function (properties, stream) {
    return function (response) {
        response.statusCode = properties.statusCode
        response.statusMessage = coalesce(properties.statusMessage)
        response.setHeader('transfer-encoding', 'chunked')
        for (var name in properties.headers) {
            if (name != 'content-length' && name != 'transfer-encoding') {
                response.setHeader(name, properties.headers[name])
            }
        }
        stream.pipe(response)
    }
}

module.exports = Reactor
