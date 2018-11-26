require('proof')(24, require('cadence')(prove))

function prove (async, okay) {
    var cadence = require('cadence')
    var Reactor = require('..')
    var UserAgent = require('vizsla')
    var http = require('http')
    var connect = require('connect')
    var coalesce = require('extant')
    var stream = require('stream')

    // Defaults, but we call the default functions below as well.
    new Reactor(this, function (constructor) {})

    var now = 0, logs = []
    function Service () {
        this.reactor = new Reactor(this, function (constructor) {
            constructor.turnstiles = 1
            constructor.timeout = 5

            var logger = constructor.logger
            constructor.logger = function (entry) {
                if (logs.length != 0) {
                    var expect = logs.shift()
                    okay(expect.error, entry.error.message, expect.message)
                }
                logger(entry)
            }

            constructor.Date = { now: function () { return now } }

            constructor.useDefault()
            constructor.use([ function (request, response, next) {
                next()
            } ])

            constructor.dispatch('GET /', 'index')
            constructor.dispatch('GET /throw/number', 'throwNumber')
            constructor.dispatch('GET /throw/redirect', 'throwRedirect')
            constructor.dispatch('GET /throw/array', 'throwArray')
            constructor.dispatch('GET /callback/thrown', 'callbackThrown')
            constructor.dispatch('GET /exception', 'exception')
            constructor.dispatch('GET /json', 'json')
            constructor.dispatch('GET /hang', 'hang')
            constructor.dispatch('GET /response', 'response')
            constructor.dispatch('GET /callbacky', 'callbacky')
            constructor.dispatch('GET /resources/:id', 'resource')
            constructor.dispatch('POST /post', 'post')
        })
    }

    Service.prototype.index = cadence(function () {
        return [ 'Service API', { 'content-type': 'text/plain' } ]
    })

    Service.prototype.throwNumber = cadence(function (async, request) {
        throw 401
    })

    Service.prototype.throwArray = cadence(function (async, request) {
        throw [ {} ]
    })

    Service.prototype.throwRedirect = cadence(function (async, request) {
        throw '/redirect'
    })

    Service.prototype.exception = cadence(function (async, request) {
        throw new Error('exception')
    })

    Service.prototype.json = cadence(function (async) {
        return { key: 'value' }
    })

    Service.prototype.response = cadence(function (async) {
        return Reactor.resend(200, { 'content-type': 'application/json' }, new Buffer(JSON.stringify({ value: 'responded' })))
    })

    Service.prototype.resource = cadence(function (async, request, id) {
        return { id: id }
    })

    Service.prototype.post = cadence(function (async, request) {
        return {}
    })

    Service.prototype.callbacky = cadence(function (async) {
        var through = new stream.PassThrough
        through.end('x\n')
        return Reactor.stream({ 'content-type': 'text/plain' }, through)
    })

    Service.prototype.callbackThrown = cadence(function (async) {
        return function (response, callback) {
            throw new Error('foo')
        }
    })

    Service.prototype.hang = cadence(function (async, request) {
        async(function () {
            this.wait = async()
            this.notify.call()
        }, function () {
            return { hang: true }
        })
    })

    var service = new Service

    var server = http.createServer(service.reactor.middleware)
    var ua = new UserAgent, session = { url: 'http://127.0.0.1:8077' }

    async(function () {
        server.listen(8077, '127.0.0.1', async())
    }, [function () {
        server.close(async())
    }], function () {
        ua.fetch(session, { parse: 'text' }, async())
    }, function (body) {
        okay(body.toString(), 'Service API', 'get')
        ua.fetch(session, { url: '/throw/number', parse: UserAgent.json(4) }, async())
    }, function (body, response) {
        okay(response.statusCode, 401, 'thrown number status code')
        okay(body, 'Unauthorized', 'thrown number message')
        ua.fetch(session, { url: '/throw/redirect', parse: UserAgent.json(3) }, async())
    }, function (body, response) {
        okay(response.statusCode, 307, 'thrown redirect status code')
        okay(response.headers.location, '/redirect', 'thrown redirect location')
        okay(body, 'Temporary Redirect', 'thrown redirect message')
        ua.fetch(session, { url: '/throw/array', parse: 'json' }, async())
    }, function (body, response) {
        okay(response.statusCode, 200, 'thrown array status code')
        okay(body, {}, 'thrown array body')
        ua.fetch(session, { url: '/exception', parse: UserAgent.json(5) }, async())
    }, function (body, response) {
        okay(response.statusCode, 500, 'exception status code')
        // Node.js 0.10 does not parse the status messsage.
        okay(coalesce(response.statusMessage, 'Internal Server Error'), 'Internal Server Error', 'exception status message')
        okay(body, 'Internal Server Error', 'exception status code')
        ua.fetch(session, { url: '/json', parse: 'json' }, async())
    }, function (body, response) {
        okay(body, { key: 'value' }, 'json')
        ua.fetch(session, { url: '/response', parse: 'json' }, async())
    }, function (body, response) {
        okay(body, { value: 'responded' }, 'resend')
        ua.fetch(session, {
            url: '/post',
            headers: { 'content-type': 'application/json' },
            post: new Buffer('{'),
            parse: UserAgent.json(4)
        }, async())
    }, function (body, response) {
        console.log(body)
        okay(response.statusCode, 400, 'cannot parse')
        okay(coalesce(response.statusMessage, 'Bad Request'), 'Bad Request', 'cannot parse message')
        okay(body, 'Bad Request', 'cannot parse body')
        ua.fetch(session, { url: '/callbacky', parse: 'text' }, async())
    }, function (body, response) {
        okay(body.toString(), 'x\n', 'callbacky')
        logs.push({
            error: 'foo',
            message: 'error during stream'
        })
        ua.fetch(session, { url: '/callback/thrown', parse: 'dump' }, async())
    }, function (body, response) {
        okay(response.statusCode, 200, 'callback thrown')
        ua.fetch(session, { url: '/resources/123', parse: 'json' }, async())
    }, function (body, response) {
        okay(body, { id: '123' }, 'resource id')
        async(function () {
            service.notify = async()
            async(function () {
                ua.fetch(session, { url: '/hang', parse: 'json' }, async())
            }, function (body, response) {
                okay(body, { hang: true }, 'delay replied')
            })
            async(function () {
                setTimeout(async(), 250)
            }, function () {
                now += 1000
                ua.fetch(session, { url: '/json', parse: 'json' }, async())
                service.wait()
            }, function (body, response) {
                okay(body, { key: 'value' }, 'flush replied')
            })
        })
        async(function () {
            setTimeout(async(), 50)
        }, function () {
            ua.fetch(session, { url: '/json', parse: UserAgent.json(5) }, async())
        }, function (body, response) {
            okay(response.statusCode, 503, 'timeout code')
            okay(body, 'Service Unavailable', 'timeout message')
        })
    })
}
