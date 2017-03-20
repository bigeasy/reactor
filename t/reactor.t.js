require('proof/redux')(17, require('cadence')(prove))

function prove (async, assert) {
    var cadence = require('cadence')
    var Dispatcher = require('..')
    var UserAgent = require('vizsla')
    var http = require('http')
    var connect = require('connect')

    var now = 0
    function Service () {
        this.reactor = new Dispatcher(this, function (constructor) {
            constructor.turnstiles = 1
            constructor.timeout = 5

            constructor.Date = { now: function () { return now } }

            constructor.dispatch('GET /', 'index')
            constructor.dispatch('GET /error', 'error')
            constructor.dispatch('GET /throw/number', 'throwNumber')
            constructor.dispatch('GET /throw/redirect', 'throwRedirect')
            constructor.dispatch('GET /exception', 'exception')
            constructor.dispatch('GET /json', 'json')
            constructor.dispatch('GET /hang', 'hang')
            constructor.dispatch('GET /response', 'response')
            constructor.dispatch('GET /callbacky', 'callbacky')
            constructor.dispatch('GET /resources/:id', 'resource')
        })
    }

    Service.prototype.index = cadence(function () {
        return 'Service API'
    })

    Service.prototype.error = cadence(function (async, request) {
        request.raise(401)
    })

    Service.prototype.throwNumber = cadence(function (async, request) {
        throw 401
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
        return Dispatcher.resend(200, { 'content-type': 'text/plain' }, 'responded')
    })

    Service.prototype.resource = cadence(function (async, request, id) {
        return { id: id }
    })

    Service.prototype.callbacky = cadence(function (async) {
        return cadence(function (async, response) {
            response.writeHeader(200, {
                'content-type': 'text/plain',
                'content-length': 2
            })
            response.end('x\n')
        })
    })

    Service.prototype.hang = cadence(function (async, request) {
        async(function () {
            this.wait = async()
            ; (this.notify)()
        }, function () {
            return { hang: true }
        })
    })

    var service = new Service

    var server = http.createServer(service.reactor.createMiddleware())
    var ua = new UserAgent, session = { url: 'http://127.0.0.1:8077' }

    async(function () {
        server.listen(8077, '127.0.0.1', async())
    }, function () {
        ua.fetch(session, async())
    }, function (body) {
        assert(body.toString(), 'Service API', 'get')
        ua.fetch(session, { url: '/error' }, async())
    }, function (body, response) {
        assert(response.statusCode, 401, 'error status code')
        assert(body, { description: 'Unknown' }, 'error message')
        ua.fetch(session, { url: '/throw/number' }, async())
    }, function (body, response) {
        assert(response.statusCode, 401, 'thrown numbber status code')
        assert(body, { description: 'Unknown' }, 'thrown number message')
        ua.fetch(session, { url: '/throw/redirect' }, async())
    }, function (body, response) {
        assert(response.statusCode, 307, 'thrown redirect status code')
        assert(response.headers.location, '/redirect', 'thrown redirect location')
        assert(body, { description: 'Unknown' }, 'thrown redirect message')
        ua.fetch(session, { url: '/exception' }, async())
    }, function (body, response) {
        assert(response.statusCode, 500, 'exception status code')
        ua.fetch(session, { url: '/json' }, async())
    }, function (body, response) {
        assert(body, { key: 'value' }, 'json')
        ua.fetch(session, { url: '/response' }, async())
    }, function (body, response) {
        assert(body.toString(), 'responded', 'json')
        ua.fetch(session, { url: '/callbacky' }, async())
    }, function (body, response) {
        assert(body.toString(), 'x\n', 'callbacky')
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
            assert(body, { description: 'Service Not Available' }, 'timeout message')
        })
    }, function (body, response) {
        server.close(async())
    })
}
