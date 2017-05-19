require('proof')(7, require('cadence')(prove))

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
            }
        }, async())
    }, function (error) {
        assert(error, 401, 'basic auth forbidden code')
    }], function () {
        authenticator.token({
            authorization: {
                scheme: 'Basic',
                credentials: authenticator._auth
            }
        }, async())
    }, function (response) {
        assert(response.token_type, 'Bearer', 'basic auth token type')
        assert(response.access_token, 'basic auth access token')
        try {
            authenticator.authenticate({})
        } catch (error) {
            assert(error, 401, 'no authorization forbidden code')
        }
        try {
            authenticator.authenticate({
                authorization: {
                    scheme: 'Bearer',
                    credentials: 'x'
                }
            })
        } catch (error) {
            assert(error, 401, 'bearer forbidden code')
        }
        authenticator.authenticate({
            authorization: {
                scheme: 'Bearer',
                credentials: response.access_token
            }
        })
    })
}
