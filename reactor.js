// Node.js API.
var http = require('http')

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
            request.entry = {
                when: {
                    push: Date.now(),
                    start: null,
                    headers: null,
                    finih: null
                },
                health: {
                    push: JSON.parse(JSON.stringify(queue.turnstile.health)),
                    start: null,
                    finish: null
                },
                request: {
                    method: request.method,
                    header: request.headers,
                    url: request.url,
                    vargs: vargs
                }
            }
            before(request, response, function (error) {
                queue.push({
                    error: coalesce(error),
                    operation: operation,
                    request: request,
                    response: response,
                    vargs: vargs
                })
            })
        }
    }
}

// Add using configurator! Configure using configurator!
function injectParsers (handler) {
    var before = require('connect')()
        .use(require('express-auth-parser'))
    // TODO Configurable.
        .use(require('body-parser').urlencoded({ extended: false, limit: '64mb' }))
        .use(require('body-parser').json({ limit: '64mb' }))
    return handler(before)
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
    this._completed = coalesce(constructor.completed, nop)
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

Reactor.prototype._timeout = cadence(function () { throw 503 })

function createProperties (properties) {
    return {
        statusCode: properties.statusCode,
        headers: coalesce(properties.headers, {}),
        description: coalesce(properties.description)
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

    entry.when.start = Date.now()
    entry.health.start = JSON.parse(JSON.stringify(this.turnstile.health))

    work.request.entry = entry
    work.request.raise = raise

    if (envelope.timedout) {
        work.operation = Operation([ this, '_timeout' ])
    }

    var finish

    async(function () {
        async(function () {
            async([function () {
                async(function () {
                    if (work.error) {
                        throw work.error
                    }
                    work.operation.apply(null, [ work.request ].concat(work.vargs, async()))
                }, function () {
                    var vargs = Array.prototype.slice.call(arguments)

                    var result = vargs.shift()
                    var statusCode = (typeof vargs[0] == 'number') ? vargs.shift() : 200
                    var description = http.STATUS_CODES[statusCode]
                    if (typeof vargs[0] == 'string') {
                        description = vargs.shift()
                    }
                    if (vargs[0] == null) {
                        vargs.shift()
                    }
                    var headers = coalesce(vargs.shift(), {})

                    interrupt.assert(description != null, 'unknown.http.status', { statusCode: statusCode })

                    return [ result, statusCode, description, headers ]
                })
            }, function (caught) {
                for (;;) {
                    try {
                        return rescue(/^reactor#http$/m, function (error) {
                            var statusCode = error.statusCode
                            var description = coalesce(error.description, http.STATUS_CODES[statusCode])
                            var headers = coalesce(error.headers, {})

                            interrupt.assert(description != null, 'unknown.http.status', { statusCode: statusCode })

                            headers['content-type'] = 'application/json'

                            return [ description, statusCode, description, headers ]
                        })(caught)
                    } catch (error) {
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
                            entry.error = error
                            error = { statusCode: 500 }
                        }
                        caught = error
                    }
                }
            }])
        }, function (result, statusCode, description, headers) {
            var body, f
            if (typeof result == 'function') {
                f = result
            } else {
                if (typeof result == 'string') {
                    if (!('content-type' in headers)) {
                        headers['content-type'] = 'text/plain'
                        result = new Buffer(result)
                    } else if (headers['content-type'] == 'application/json') {
                        result = new Buffer(JSON.stringify(result) + '\n')
                    }
                } else if (!('content-type' in headers)) {
                    headers['content-type'] = 'application/json'
                    result = new Buffer(JSON.stringify(result) + '\n')
                }
                f = function (response) {
                    response.end(result)
                }
            }

            work.response.writeHead(statusCode, description, headers)

            entry.statusCode = statusCode
            entry.description = description
            entry.headers = headers

            var finish = delta(async()).ee(work.response).on('finish')

            async([function () {
                async(function () {
                    if (result.length == 2) {
                        f.call(work.operation.object, work.response, async())
                    } else {
                        return [ f.call(work.operation.object, work.response) ]
                    }
                }, function () {
                    return []
                })
            }, function (error) {
                entry.error = error
                work.response.end()
                finish.cancel()
            }])
        })
    }, function () {
        entry.health.done = JSON.parse(JSON.stringify(this.turnstile.health))
        entry.when.finish = Date.now()
        entry.duration = {
            start: entry.when.start - entry.when.push,
            headers: entry.when.headers - entry.when.push,
            finish: entry.when.finish - entry.when.push
        }
        this._logger.call(null, 'info', 'request', entry)
        this._completed.call(null, entry)
    })
})

Reactor.resend = function (statusCode, headers, body) {
    return Reactor.send({ statusCode: statusCode, headers: headers }, body)
}

Reactor.send = function (properties, buffer) {
    var headers = JSON.parse(JSON.stringify(properties.headers))
    delete headers['content-length']
    delete headers['transfer-encoding']
    return [ buffer, properties.statusCode, properties.statusMessage, headers ]
}

Reactor.string = function (statusCode, contentType, text) {
    return [ new Buffer(text), statusCode, { 'content-type': contentType } ]
}

Reactor.stream = function (properties, stream) {
    var headers = JSON.parse(JSON.stringify(properties.headers))
    delete headers['content-length']
    headers['transfer-encoding'] = 'chunked'
    return [ function (response) {
        stream.pipe(response)
    }, properties.statusCode, properties.statusMessage, headers ]
}

module.exports = Reactor
