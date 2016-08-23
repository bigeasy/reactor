require('proof')(5, require('cadence')(prove))

function prove (async, assert) {
    var Reactor = require('..')
    var abend = require('abend')
    var slice = [].slice

    new Reactor(function () {})

    var waiting = null
    var reactor = new Reactor({
        operation: function () {
            waiting.apply(this, slice.call(arguments))
        },
        workers: 1
    })

    // The use of `setImmediate` below allows for both the `wait` callback and
    // the turnstile function callback to complete before proceeding to the next
    // test so that we start each test with no occupied turnstiles. This was
    // added when I wanted to test the turnstile `health` end point at the every
    // end. I wanted to see the expected zero occupied so I had to wait a tick.
    // I then went back and made it uniform.

    async(function () {
        var wait = async()
        waiting = function (status, value, callback) {
            assert(value, 1, 'queued')
            waiting = function (status, value, callback) {
                assert(value, 2, 'queued grouped')
                wait()
                callback()
            }
            reactor.push(2)
            callback()
        }
        reactor.push(1, async())
    }, function () {
        setImmediate(async())
    }, function () {
        var wait = async()
        waiting = function (status, key, callback) {
            assert(key, 'a', 'callback')
            wait()
            callback()
        }
        reactor.set('a')
        reactor.set('a', async())
    }, function () {
        setImmediate(async())
    }, function () {
        var wait = async()
        waiting = function (status, callback) {
            assert(true, 'called')
            reactor.check()
            waiting = function (status, callback) {
                wait()
                callback()
            }
            callback()
        }
        reactor.check(async())
    }, function () {
        setImmediate(async())
    }, function () {
        assert(reactor.turnstile.health, { occupied: 0, waiting: 0, rejecting: 0, turnstiles: 1 }, 'health')
    })
}
