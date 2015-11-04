var cadence = require('cadence'),
    Operation = require('operation'),
    abend = require('abend'),
    push = [].push,
    slice = [].slice

function Reactor (options) {
    this.turnstile = options.turnstile
    this.count = 0
    this._operation = new Operation(options.operation)
    this._values = { system: {}, user: {} }
}

Reactor.prototype.push = function (key, values, callback) {
    var vargs = slice.call(arguments), map = 'system', key = 'default'
    if (typeof vargs[0] == 'string') {
        map = 'user'
        key = vargs.shift()

    }
    var entry = this._entry(map, key, [])
    push.apply(entry.values, vargs[0])
    this.count += vargs[0].length
    if (vargs[1]) entry.callbacks.push(vargs[1])
    this.turnstile.nudge(abend)
}

Reactor.prototype.check = function () {
    var vargs = slice.call(arguments), map = 'system', key = 'default'
    if (typeof vargs[0] == 'string') {
        map = 'user'
        key = String(vargs.shift())
    }
    var entry = this._entry(map, key, true)
    this.count++
    if (vargs[0]) entry.callbacks.push(vargs[0])
    this.turnstile.nudge(abend)
}

Reactor.prototype._entry = function (map, key, initial) {
    var entry = this._values[map][key]
    if (!entry) {
        entry = this._values[map][key] = { callbacks: [], values: initial }
        this.turnstile.enter({
            object: this, method: '_consume'
        }, [ map, key ], function (error) {
            abend(error)
            entry.callbacks.forEach(function (callback) { callback() })
        })
    }
    return entry
}

Reactor.prototype._consume = cadence(function (async, state, map, key) {
    var entry = this._values[map][key], count, vargs
    delete this._values[map][key]
    if (typeof entry.values == 'boolean') {
        count = 1
        vargs = [ state ]
    } else {
        count = entry.values.length
        vargs = [ state, entry.values ]
    }
    if (map != 'system') {
        vargs.push(key)
    }
    async([function () {
        this.count -= count
    }], function () {
        this._operation.apply(vargs.concat(async()))
    })
})

module.exports = Reactor
