require('proof/redux')(10, require('cadence')(prove))

function prove (async, assert) {
    var Authenticator = require('../authenticator'),
        UserAgent = require('vizsla')

    assert(!Authenticator.isBearer({}), 'no authentication')
    assert(!Authenticator.isBearer({ authorization: { scheme: 'Basic' } }), 'not bearer')

    var authenticator = new Authenticator('a:z')

    async([function () {
        authenticator.token({
            authorization: {
                scheme: 'Basic',
                credentials: 'x'
            },
            raise: function (code, message) {
                var error = new Error(message)
                error.code = code
                throw error
            }
        }, async())
    }, function (error) {
        assert(error.message, 'Forbidden', 'basic auth forbidden message')
        assert(error.code, 401, 'basic auth forbidden code')
    }], function () {
        authenticator.token({
            authorization: {
                scheme: 'Basic',
                credentials: authenticator._auth
            },
            raise: raise
        }, async())
    }, function (response) {
        assert(response.token_type, 'Bearer', 'basic auth token type')
        assert(response.access_token, 'basic auth access token')
        try {
            authenticator.authenticate({ raise: raise })
        } catch (error) {
            assert(error.message, 'Forbidden', 'no authorization forbidden message')
            assert(error.code, 401, 'no authorization forbidden code')
        }
        try {
            authenticator.authenticate({
                authorization: {
                    scheme: 'Bearer',
                    credentials: 'x'
                },
                raise: raise
            })
        } catch (error) {
            assert(error.message, 'Forbidden', 'bearer forbidden message')
            assert(error.code, 401, 'bearer forbidden code')
        }
        authenticator.authenticate({
            authorization: {
                scheme: 'Bearer',
                credentials: response.access_token
            },
            raise: raise
        })
    })

    function raise (code, message) {
        var error = new Error(message)
        error.code = code
        throw error
    }
}
