describe('reactor', () => {
    const assert = require('assert')
    const axios = require('axios')
    const Reactor = require('../reactor')

    class Service {
        index () { return 'Index\n' }
        async async () { return { async: true } }
        async unauthorized () { return 401 }
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

    before(() => reactor.fastify.listen(0))
    after(() => reactor.fastify.close())

    function url (path) {
        return `http://127.0.0.1:${reactor.fastify.server.address().port}${path}`
    }

    it('can get a sync function', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        const response = await axios.get(url('/'))
        assert.equal(response.data, 'Index\n', 'got')
        test[0].duration = 0
        assert.deepStrictEqual(test, [{
            code: 200,
            duration: 0,
            error: null,
            path: '/'
        }], 'test')
    })

    it('can get an async function', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        const response = await axios.get(url('/async'))
        assert.deepStrictEqual(response.data, { async: true }, 'got')
        test[0].duration = 0
        assert.deepStrictEqual(test, [{
            code: 200,
            duration: 0,
            error: null,
            path: '/async'
        }], 'test')
    })

    it('can get an error code', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        try {
            await axios.get(url('/unauthorized'))
        } catch (error) {
            test.push(error.response.status)
        }
        test[0].duration = 0
        assert.deepStrictEqual(test, [{
            code: 401,
            duration: 0,
            error: null,
            path: '/unauthorized'
        }, 401 ], 'test')
    })

    it('can get a thrown error code', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        try {
            await axios.get(url('/missing'))
        } catch (error) {
            test.push(error.response.status)
        }
        test[0].duration = 0
        assert.deepStrictEqual(test, [{
            code: 404,
            duration: 0,
            error: null,
            path: '/missing'
        }, 404 ], 'test')
    })

    it('can get an error', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        try {
            await axios.get(url('/error'))
        } catch (error) {
            test.push(error.response.status)
        }
        test[0].duration = 0
        test[0].error = test[0].error.message
        assert.deepStrictEqual(test, [{
            code: 500,
            duration: 0,
            error: 'error',
            path: '/error'
        }, 500 ], 'test')
    })

    it('can hangup on error', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        try {
            await axios.get(url('/hangup'))
        } catch (error) {
            test.push(error.code)
        }
        test[0].duration = 0
        assert.deepStrictEqual(test, [{
            code: 500,
            duration: 0,
            error: null,
            path: '/hangup'
        }, 'ECONNRESET' ], 'test')
    })

    it('can get a raw function', async () => {
        const test = []
        reactor.once('reply', (entry) => test.push(entry))
        const response = await axios.get(url('/raw'))
        assert.equal(response.data, 'hello, world\n', 'got')
        test[0].duration = 0
        assert.deepStrictEqual(test, [{
            code: 200,
            duration: 0,
            path: '/raw'
        }], 'test')
    })
})
