require('proof')(1, prove)

function prove (okay, callback) {
    var Destructible = require('destructible')
    var destructible = new Destructible('t/shorthand.t')

    destructible.completed.wait(callback)

    var connect = require('connect')

    var cadence = require('cadence')

    cadence(function (async) {
        async(function () {
        }, function () {
        })
    })(destructible.durable('test'))
}
