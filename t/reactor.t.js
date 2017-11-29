require('proof')(22, require('cadence')(prove))

function prove (async, assert) {
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
                    assert(expect.error, entry.error.message, expect.message)
                }
                logger(entry)
            }

            constructor.Date = { now: function () { return now } }

            constructor.useDefault()
            constructor.use([ function (request, response, next) {
                next()
            } ])

            constructor.dispatch('GET /', 'index')
            constructor.dispatch('GET /error', 'error')
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
        ua.fetch(session, async())
    }, function (body) {
        assert(body.toString(), 'Service API', 'get')
        ua.fetch(session, { url: '/throw/number' }, async())
    }, function (body, response) {
        assert(response.statusCode, 401, 'thrown numbber status code')
        assert(body, 'Unauthorized', 'thrown number message')
        ua.fetch(session, { url: '/throw/redirect' }, async())
    }, function (body, response) {
        assert(response.statusCode, 307, 'thrown redirect status code')
        assert(response.headers.location, '/redirect', 'thrown redirect location')
        assert(body, 'Temporary Redirect', 'thrown redirect message')
        ua.fetch(session, { url: '/throw/array' }, async())
    }, function (body, response) {
        assert(response.statusCode, 200, 'thrown array status code')
        assert(body, {}, 'thrown array body')
        ua.fetch(session, { url: '/exception' }, async())
    }, function (body, response) {
        assert(response.statusCode, 500, 'exception status code')
        // Node.js 0.10 does not parse the status messsage.
        assert(coalesce(response.statusMessage, 'Internal Server Error'), 'Internal Server Error', 'exception status message')
        ua.fetch(session, { url: '/json' }, async())
    }, function (body, response) {
        assert(body, { key: 'value' }, 'json')
        ua.fetch(session, { url: '/response' }, async())
    }, function (body, response) {
        assert(body, { value: 'responded' }, 'resend')
        ua.fetch(session, {
            url: '/post',
            headers: { 'content-type': 'application/json' },
            post: new Buffer('{')
        }, async())
    }, function (body, response) {
        assert(response.statusCode, 400, 'cannot parse')
        assert(coalesce(response.statusMessage, 'Bad Request'), 'Bad Request', 'cannot parse message')
        ua.fetch(session, { url: '/callbacky' }, async())
    }, function (body, response) {
        assert(body.toString(), 'x\n', 'callbacky')
        logs.push({
            error: 'foo',
            message: 'error during stream'
        })
        ua.fetch(session, { url: '/callback/thrown' }, async())
    }, function (body, response) {
        assert(response.statusCode, 200, 'callback thrown')
        ua.fetch(session, { url: '/resources/123' }, async())
    }, function (body, response) {
        assert(body, { id: '123' }, 'resource id')
        async(function () {
            service.notify = async()
            async(function () {
                ua.fetch(session, { url: '/hang' }, async())
            }, function (body, response) {
                assert(body, { hang: true }, 'delay replied')
            })
            async(function () {
                setTimeout(async(), 250)
            }, function () {
                now += 1000
                ua.fetch(session, { url: '/json' }, async())
                service.wait()
            }, function (body, response) {
                assert(body, { key: 'value' }, 'flush replied')
            })
        })
        async(function () {
            setTimeout(async(), 50)
        }, function () {
            ua.fetch(session, { url: '/json' }, async())
        }, function (body, response) {
            assert(response.statusCode, 503, 'timeout code')
            assert(body, 'Service Unavailable', 'timeout message')
        })
    })
}
