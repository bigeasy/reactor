require('proof')(4, require('cadence')(prove))

function prove (async, assert) {
    var Reactor = require('../..')
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

    async(function () {
        var wait = async()
        waiting = function (status, value, callback) {
            assert(value, 1, 'queued')
            waiting = function (status, value, callback) {
                assert(value, 2, 'queued grouped')
                callback()
                wait()
            }
            reactor.push(2)
            callback()
        }
        reactor.push(1, async())
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
