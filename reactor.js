var Turnstiles = require('turnstile'),
    cadence = require('cadence'),
    Operation = require('operation'),
    abend = require('abend'),
    push = [].push,
    slice = [].slice

function Reactor (options) {
    options.operation || (options = { operation: options })
    this.turnstiles = new Turnstiles({
        Date: options.Date,
        turnstiles: options.turnstiles,
        timeout: options.timeout
    })
    this.count = 0
    this._operation = new Operation(options.operation)
    this._enqueued = { check: {}, set: {} }
    this._values = { system: {}, user: {} }
}

Reactor.prototype.push = function (value, callback) {
    this.count++
    this.turnstiles.enter({
        object: this, method: '_pop'
    }, [ value ], function (error) {
        abend(error)
        if (callback) callback()
    })
    this.turnstiles.nudge(abend)
}

Reactor.prototype._pop = cadence(function (async, state, value) {
    async([function () {
        this.count--
    }], function () {
        this._operation.apply([ state, value ].concat(async()))
    })
})

Reactor.prototype.set = function (key, callback) {
    var map = 'set'
    var callbacks = this._entry(map, key)
    if (callback) callbacks.push(callback)
    this.turnstiles.nudge(abend)
}

Reactor.prototype.check = function (callback) {
    var map = 'check', key = 'default'
    var callbacks = this._entry(map, key)
    if (callback) callbacks.push(callback)
    this.turnstiles.nudge(abend)
}

Reactor.prototype._entry = function (map, key, initial) {
    var callbacks = this._enqueued[map][key]
    if (!callbacks) {
        this.count++
        callbacks = this._enqueued[map][key] = []
        this.turnstiles.enter({
            object: this, method: '_unset'
        }, [ map, key ], function (error) {
            abend(error)
            callbacks.forEach(function (callback) { callback() })
        })
    }
    return callbacks
}

Reactor.prototype._unset = cadence(function (async, state, map, key) {
    delete this._enqueued[map][key]
    var vargs = map == 'check' ? [ state ] : [ state, key ]
    async([function () {
        this.count--
    }], function () {
        this._operation.apply(vargs.concat(async()))
    })
})

module.exports = Reactor
