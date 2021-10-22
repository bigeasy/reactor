const http = require('http')
const events = require('events')
const { coalesce } = require('extant')

class Reactor extends events.EventEmitter {
    constructor (routes) {
        super()
        const fastify = this.fastify = require('fastify')()
        for (const route of routes) {
            fastify[route.method](route.path, this._reply.bind(this, route))
        }
    }

    _send (route, request, reply, now, code, body, headers, error) {
        if (body == null) {
            body = { statusCode: code, message: http.STATUS_CODES[code] }
        }
        this.emit('reply', { path: route.path, code, duration: Date.now() - now, error, headers })
        if (Math.floor(code / 100) != 2 && route.hangup) {
            request.raw.destroy()
        } else {
            reply.code(code)
            reply.send(body)
        }
    }

    async _reply (route, request, reply) {
        const now = Date.now()
        if (route.raw) {
            try {
                return await route.f.call(null, request, reply)
            } finally {
                this.emit('reply', { path: route.path, code: reply.raw.statusCode, duration: Date.now() - now })
            }
        } else {
            try {
                const result = await route.f.call(null, request, reply)
                if (typeof result == 'number') {
                    this._send(route, request, reply, now, result, null, {}, null)
                } else if (Array.isArray(result) && typeof result[0] == 'number') {
                    this._send(route, request, reply, now, result[0], coalesce(result[1], http.STATUS_CODES[result[1]]), coalesce(result[2], {}), null)
                } else {
                    this._send(route, request, reply, now, 200, result, {}, null)
                }
            } catch (error) {
                if (typeof error == 'number') {
                    this._send(route, request, reply, now, error, null, {}, null)
                } else if (Array.isArray(error) && typeof error[0] == 'number') {
                    this._send(route, request, reply, now, error[0], coalesce(error[1], http.STATUS_CODES[error[1]]), coalesce(error[2], {}), null)
                } else {
                    this._send(route, request, reply, now, 500, null, {}, error)
                }
            }
        }
    }
}

module.exports = Reactor
