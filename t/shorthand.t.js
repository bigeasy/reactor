require('proof')(1, prove)

function prove (okay, callback) {
    var Destructible = require('destructible')
    var destructible = new Destructible('t/shorthand.t')

    destructible.completed.wait(callback)

    var connect = require('connect')
    var Reactor = require('..')

    var cadence = require('cadence')
    var delta = require('delta')

    var http = require('http')

    var UserAgent = require('vizsla')
    var ua = new UserAgent

    cadence(function (async) {
        async(function () {
            // Maybe `turnstile` is exposed as a property of the request? That
            // way you can log it in response to a `curl`. Could also expose it
            // to the logger itself as a second property, but then why not place
            // it in .
            var app = connect()
                .use(Reactor.json())
                .use(Reactor.auth())
                .use(Reactor.urlencoded())
                .use(Reactor.reactor({
                    object: 0
                }, function (configurator) {
                    configurator.turnstile.health.turnstiles = 24
                    setInterval(function () {
                        console.log('turnstile', configurator.turnstile.health)
                    }, 1000).unref()
                    configurator.routes({
                        'GET /': cadence(function () {
                            return [ { 'content-type': 'text/plain' }, 'API Index\n' ]
                        })
                    })
                    configurator.logger = function (entry) {
                        console.log(entry)
                    }
                }))
            var server = http.createServer(app)
            async(function () {
                server.listen(8888)
                delta(async()).ee(server).on('listening')
            }, [function () {
                server.close()
            }], function () {
                ua.fetch({
                    url: 'http://127.0.0.1:8888/',
                    parse: 'text'
                }, async())
            }, function (body) {
                okay(body, 'API Index\n', 'got')
            })
        })
    })(destructible.durable('test'))
}
