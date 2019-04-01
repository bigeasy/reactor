// Node.js API.
var http = require('http')

// Control-flow utilities.
var cadence = require('cadence')
var delta = require('delta')

// Route Sencha Connect middleware based on request method and URL patterns.
var dispatch = require('dispatch')

// Exceptions that you can catch by type.
var Interrupt = require('interrupt').createInterrupter('reactor')

// Contextualized callbacks and event handlers.
var operation = require('operation')

// Evented work queue.
var Turnstile = require('turnstile')
Turnstile.Queue = require('turnstile/queue')

// Catch exceptions based on a regex match of an error message or property.
var rescue = require('rescue')

// Return the first not null-like value.
var coalesce = require('extant')

// Do nothing.
var noop = require('nop')

// MIME type parser.
var typer = require('content-type')

var arrayed = require('./arrayed')

var explode = require('./explode')

function Configurator (object, dispatch, turnstile) {
    this._object = object
    this._dispatch = dispatch
    this._use = []
    this._defaultUse = true
    this.turnstile = turnstile
    this.logger = function (entry) {
        if (entry.error) {
            console.log(entry.error.stack)
        }
    }
}

Configurator.prototype.useDefault = function () {
    this.use(require('express-auth-parser'))
    this.use(require('body-parser').urlencoded({ extended: false, limit: '64mb' }))
    this.use(require('body-parser').json({ limit: '64mb' }))
}

Configurator.prototype.use = function () {
    var vargs = Array.prototype.slice.call(arguments)
    this._defaultUse = false
    while (vargs.length) {
        var varg = vargs.shift()
        if (Array.isArray(varg)) {
            this._use.push.apply(this._use, varg)
        } else {
            this._use.push(varg)
        }
    }
}

Configurator.prototype.routes = function (routes) {
    for (var key in routes) {
        this.dispatch(key, routes[key])
    }
}

Configurator.prototype.dispatch = function () {
    var vargs = []
    vargs.push.apply(vargs, arguments)
    this._dispatch[vargs.shift()] = operation.shift.call(this._object, vargs)
}

function handler (queue, before, operation) {
    return function (request, response, next) {
        var vargs = Array.prototype.slice.call(arguments, 3)
        request.entry = {
            when: {
                push: Date.now(),
                start: null,
                headers: null,
                finish: null
            },
            health: {
                push: JSON.parse(JSON.stringify(queue.turnstile.health)),
                start: null,
                finish: null
            },
            duration: {
                start: null,
                headers: null,
                finish: null,
            },
            request: {
                method: request.method,
                header: request.headers,
                headers: request.headers,
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

function Reactor (object, configure, turnstile) {
    this.turnstile = turnstile || new Turnstile({ turnstiles: 24 })
    var constructor = new Configurator(object, this._dispatch = {}, this.turnstile)
    if (typeof configure == 'object') {
        constructor.routes(configure)
    } else {
        configure(constructor)
    }
    this._queue = new Turnstile.Queue(this, '_respond', this.turnstile)
    this._logger = constructor.logger
    this._completed = coalesce(constructor.completed, noop)
    this._object = object
    if (constructor._defaultUse) {
        constructor.useDefault()
    }
    var before = require('connect')()
    constructor._use.forEach(function (middleware) {
        before.use(middleware)
    })
    var dispatcher = {}
    for (var pattern in this._dispatch) {
        dispatcher[pattern] = handler(this._queue, before, this._dispatch[pattern])
    }
    this.middleware = require('connect')().use(this._middleware = dispatch(dispatcher))
}

Reactor.prototype._canceled = cadence(function () { throw 503 })

function createProperties (properties) {
    return {
        statusCode: properties.statusCode,
        headers: coalesce(properties.headers, {}),
        description: coalesce(properties.description)
    }
}

Reactor.prototype._respond = cadence(function (async, envelope) {
    var work = envelope.body
    var next = work.next

    var entry = work.request.entry

    entry.when.start = Date.now()
    entry.health.start = JSON.parse(JSON.stringify(this.turnstile.health))

    work.request.entry = entry

    if (envelope.canceled) {
        work.operation = operation.shift([ this, '_canceled' ])
    }

    var finish

    async(function () {
        async(function () {
            async([function () {
                async(function () {
                    if (work.error) {
                        throw { cause: work.error, statusCode: coalesce(work.error.statusCode) }
                    }
                    work.operation.apply(null, [ work.request ].concat(work.vargs, async()))
                }, function () {
                    return arrayed(Array.prototype.slice.call(arguments))
                })
            }, function (caught) {
                for (;;) {
                    try {
                        return rescue(/^reactor#http$/m, function (rescued) {
                            var error = rescued.errors.shift()
                            var statusCode = error.statusCode
                            var description = coalesce(error.description, http.STATUS_CODES[statusCode])
                            var headers = coalesce(error.headers, {})
                            var body = coalesce(error.body, description)

                            if (error.causes.length != 0) {
                                entry.error = {
                                    message: error.causes[0].message,
                                    stack: error.causes[0].stack
                                }
                            }

                            Interrupt.assert(description != null, 'unknown.http.status', { statusCode: statusCode })

                            return {
                                statusCode,
                                description: description,
                                headers: headers,
                                body: body
                            }
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
                        if (Array.isArray(error)) {
                            error = new Interrupt('http', arrayed(error.slice()))
                        } else if (
                            ! (error instanceof Error) &&
                            typeof error == 'object' &&
                            typeof error.statusCode == 'number' &&
                            !isNaN(error.statusCode) &&
                            (error.statusCode | 0) === error.statusCode &&
                            Math.floor(error.statusCode / 100) <= 5 &&
                            Math.floor(error.statusCode / 100) >= 2
                        ) {
                            var properties = createProperties(error)
                            if (error.location) {
                                properties.headers.location = error.location
                            }
                            properties.cause = coalesce(error.cause)
                            error = new Interrupt('http', properties)
                        } else {
                            error = { statusCode: 500, cause: error }
                        }
                        caught = error
                    }
                }
            }])
        }, function (responder) {
            var body, f
            if (typeof responder.body == 'function') {
                f = responder.body
            } else {
                if (!('content-type' in responder.headers)) {
                    responder.headers['content-type'] = 'application/json'
                }
                var type = typer.parse(responder.headers['content-type'])
                if (
                    !Buffer.isBuffer(responder.body) &&
                    type.type == 'application/json'
                ) {
                    responder.body = new Buffer(JSON.stringify(responder.body) + '\n')
                }
                f = function (response) {
                    response.end(responder.body)
                }
            }

            work.response.writeHead(responder.statusCode, responder.description, responder.headers)

            entry.when.headers = Date.now()

            entry.statusCode = responder.statusCode
            entry.description = responder.description
            entry.headers = responder.headers

            var finish = delta(async()).ee(work.response).on('finish')

            async([function () {
                async(function () {
                    if (f.length == 2) {
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
        entry.health.finish = JSON.parse(JSON.stringify(this.turnstile.health))
        entry.when.finish = Date.now()
        entry.duration = {
            start: entry.when.start - entry.when.push,
            headers: entry.when.headers - entry.when.push,
            finish: entry.when.finish - entry.when.push
        }
        if (entry.error) {
            explode(entry, 'error', entry.error)
        }
        this._logger.call(null, entry)
        this._completed.call(null, entry)
    })
})

Reactor.json = function () {
    return require('body-parser').json({ limit: '64mb' })
}

Reactor.auth = function () {
    return require('express-auth-parser')
}

Reactor.reactor = function (object, configure, turnstile) {
    return new Reactor(object, configure, turnstile)._middleware
}

Reactor.resend = function (statusCode, headers, body) {
    return Reactor.send({ statusCode: statusCode, headers: headers }, body)
}

Reactor.send = function (properties, buffer) {
    var headers = JSON.parse(JSON.stringify(properties.headers))
    delete headers['content-length']
    delete headers['transfer-encoding']
    return [ properties.statusCode, properties.statusMessage, headers, buffer ]
}

Reactor.stream = function (properties, stream) {
    var vargs = Array.prototype.slice.call(arguments)
    var stream = vargs.pop()
    vargs.push(function (response) { stream.pipe(response) })
    var response = arrayed(vargs)
    response.headers['content-length']
    response.headers['transfer-encoding'] = 'chunked'
    return [ response.statusCode, response.description, response.headers, response.body ]
}

module.exports = Reactor
