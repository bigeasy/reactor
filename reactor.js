const http = require('http')
const events = require('events')

class Reactor extends events.EventEmitter {
    constructor (routes) {
        super()
        const fastify = this.fastify = require('fastify')()
        routes.forEach(route => {
            fastify[route.method](route.path, this._reply.bind(this, route))
        })
    }

    _send (route, request, reply, now, result, error) {
        let body = result, code = 200
        if (typeof result == 'number') {
            code = result
            body = { statusCode: code, message: http.STATUS_CODES[code] }
        }
        this.emit('reply', { path: route.path, code, duration: Date.now() - now, error })
        if (Math.floor(code / 100) != 2 && route.hangup) {
            request.req.destroy()
        } else {
            reply.code(code)
            reply.send(body)
        }
    }

    async _reply (route, request, reply) {
        const now = Date.now()
        try {
            const promise = route.f.call(null, request, reply)
            const result = (promise instanceof Promise) ? await promise : promise
            this._send(route, request, reply, now, result, null)
        } catch (error) {
            if (typeof error == 'number') {
                this._send(route, request, reply, now, error, null)
            } else {
                this._send(route, request, reply, now, 500, error)
            }
        }
    }
}

module.exports = Reactor
