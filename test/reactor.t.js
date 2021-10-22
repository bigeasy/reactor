require('proof')(13, async (okay) => {
    const axios = require('axios')
    const Reactor = require('../reactor')

    const Destructible = require('destructible')
    const destructible = new Destructible('reactor.t.js')

    class Service {
        index () { return 'Index\n' }
        headers () { return [ 201, { created: true }, { 'X-Created': 'true' } ] }
        async async () { return { async: true } }
        async unauthorized () { return 401 }
        async forbidden () {
            throw [ 403, 'No!' ]
        }
        missing () { throw 404 }
        error () { throw new Error('error') }
        hangup () { return 500 }
    }

    const service = new Service

    const reactor = new Reactor([{
        path: '/',
        method: 'get',
        f: service.index.bind(service)
    }, {
        path: '/headers',
        method: 'get',
        f: service.headers.bind(service)
    }, {
        path: '/async',
        method: 'get',
        f: service.async.bind(service)
    }, {
        path: '/unauthorized',
        method: 'get',
        f: service.unauthorized.bind(service)
    }, {
        path: '/missing',
        method: 'get',
        f: service.missing.bind(service)
    }, {
        path: '/forbidden',
        method: 'get',
        f: service.forbidden.bind(service)
    }, {
        path: '/error',
        method: 'get',
        f: service.error.bind(service)
    }, {
        path: '/hangup',
        method: 'get',
        f: service.hangup.bind(service),
        hangup: true
    }, {
        path: '/raw',
        method: 'get',
        f: (requst, reply) => reply.send('hello, world\n'),
        raw: true
    }])

    await reactor.fastify.listen(0)
    destructible.destruct(() => reactor.fastify.close())

    function url (path) {
        return `http://127.0.0.1:${reactor.fastify.server.address().port}${path}`
    }

    destructible.ephemeral('test', async () => {
        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            const response = await axios.get(url('/'))
            okay(response.data, 'Index\n', 'got')
            test[0].duration = 0
            okay(test, [{
                code: 200,
                headers: {},
                duration: 0,
                error: null,
                path: '/'
            }], 'get a sync function')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            const response = await axios.get(url('/headers'))
            okay(response.data, { created: true }, 'got headers body')
            test[0].duration = 0
            okay(test, [{
                code: 201,
                headers: { 'X-Created': 'true' },
                duration: 0,
                error: null,
                path: '/headers'
            }], 'get an aync function')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            const response = await axios.get(url('/async'))
            okay(response.data, { async: true }, 'got')
            test[0].duration = 0
            okay(test, [{
                code: 200,
                headers: {},
                duration: 0,
                error: null,
                path: '/async'
            }], 'get an aync function')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            try {
                await axios.get(url('/unauthorized'))
            } catch (error) {
                test.push(error.response.status)
            }
            test[0].duration = 0
            okay(test, [{
                code: 401,
                headers: {},
                duration: 0,
                error: null,
                path: '/unauthorized'
            }, 401 ], 'get error code')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            try {
                await axios.get(url('/forbidden'))
            } catch (error) {
                test.push(error.response.status)
            }
            test[0].duration = 0
            okay(test, [{
                code: 403,
                headers: {},
                duration: 0,
                error: null,
                headers: {},
                path: '/forbidden'
            }, 403 ], 'get error code with specific message')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            try {
                await axios.get(url('/missing'))
            } catch (error) {
                test.push(error.response.status)
            }
            test[0].duration = 0
            okay(test, [{
                code: 404,
                headers: {},
                duration: 0,
                error: null,
                path: '/missing'
            }, 404 ], 'get thrown error code')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            try {
                await axios.get(url('/error'))
            } catch (error) {
                test.push(error.response.status)
            }
            test[0].duration = 0
            test[0].error = test[0].error.message
            okay(test, [{
                code: 500,
                headers: {},
                duration: 0,
                error: 'error',
                path: '/error'
            }, 500 ], 'get an error')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            try {
                await axios.get(url('/hangup'))
            } catch (error) {
                test.push(error.code)
            }
            test[0].duration = 0
            okay(test, [{
                code: 500,
                duration: 0,
                error: null,
                path: '/hangup',
                headers: {}
            }, 'ECONNRESET' ], 'hangup on error')
        }

        {
            const test = []
            reactor.once('reply', (entry) => test.push(entry))
            const response = await axios.get(url('/raw'))
            okay(response.data, 'hello, world\n', 'got')
            test[0].duration = 0
            okay(test, [{
                code: 200,
                duration: 0,
                path: '/raw'
            }], 'get a raw function')
        }

        destructible.destroy()
    })

    await destructible.promise
})
