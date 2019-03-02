require('proof')(7, require('cadence')(prove))

function prove (async, okay) {
    var Authenticator = require('../authenticator')

    okay(!Authenticator.isBearer({}), 'no authentication')
    okay(!Authenticator.isBearer({ authorization: { scheme: 'Basic' } }), 'not bearer')

    var authenticator = new Authenticator('a:z')

    async([function () {
        authenticator.token({
            authorization: {
                scheme: 'Basic',
                credentials: 'x'
            }
        }, async())
    }, function (error) {
        okay(error, 401, 'basic auth forbidden code')
    }], function () {
        authenticator.token({
            authorization: {
                scheme: 'Basic',
                credentials: authenticator._auth
            }
        }, async())
    }, function (response) {
        okay(response.token_type, 'Bearer', 'basic auth token type')
        okay(response.access_token, 'basic auth access token')
        try {
            authenticator.authenticate({})
        } catch (error) {
            okay(error, 401, 'no authorization forbidden code')
        }
        try {
            authenticator.authenticate({
                authorization: {
                    scheme: 'Bearer',
                    credentials: 'x'
                }
            })
        } catch (error) {
            okay(error, 401, 'bearer forbidden code')
        }
        authenticator.authenticate({
            authorization: {
                scheme: 'Bearer',
                credentials: response.access_token
            }
        })
    })
}
