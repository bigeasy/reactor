require('proof')(8, require('cadence')(prove))

function prove (async, assert) {
    var Reactor = require('../..')
    var Turnstile = require('turnstile')
    var abend = require('abend')
    var slice = [].slice

    new Reactor({
        operation: function () {}
    })

    var waiting = null
    var reactor = new Reactor({
        turnstile: new Turnstile({ workers: 1 }),
        operation: function () {
            waiting.apply(this, slice.call(arguments))
        }
    })

    async(function () {
        var wait = async()
        waiting = function (status, values, callback) {
            assert(values, [ 1, 2, 3 ], 'queued')
            waiting = function (status, values, callback) {
                assert(values, [ 4, 5, 6, 7, 8, 9 ], 'queued grouped')
                callback()
                wait()
            }
            reactor.push([ 4, 5, 6 ])
            reactor.push([ 7, 8, 9 ])
            callback()
        }
        reactor.push([ 1, 2, 3 ], async())
    }, function () {
        var wait = async()
        waiting = function (status, values, key, callback) {
            assert(values, [ 1, 3, 5 ], 'grouped values')
            assert(key, 'a', 'grouped key')
            waiting = function (status, values, key, callback) {
                assert(values, [ 2, 4, 6 ], 'grouped values')
                assert(key, 'b', 'grouped key')
                wait()
                callback()
            }
            callback()
        }
        reactor.push('a', [ 1, 3, 5 ], async())
        reactor.push('b', [ 2, 4, 6 ], async())
    }, function () {
        var wait = async()
        waiting = function (status, key, callback) {
            assert(key, 'a', 'callback')
            wait()
            callback()
        }
        reactor.check('a', async())
    }, function () {
        var wait = async()
        waiting = function (status, callback) {
            assert(true, 'called')
            reactor.check()
            waiting = function (status, callback) {
                wait()
            }
            callback()
        }
        reactor.check(async())
    })
}
