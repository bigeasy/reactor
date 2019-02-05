require('proof')(10, prove)

function prove (okay) {
    var arrayed = require('../arrayed')
    okay(arrayed([{}]), {
        statusCode: 200,
        description: 'OK',
        headers: {},
        body: {}
    }, 'object')
    okay(arrayed([]), {
        statusCode: 200,
        description: 'OK',
        headers: {},
        body: 'OK'
    }, 'empty array')
    okay(arrayed([ 404 ]), {
        statusCode: 404,
        description: 'Not Found',
        headers: {},
        body: 'Not Found'
    }, 'code only')
    okay(arrayed([ 200, 'Okay' ]), {
        statusCode: 200,
        description: 'Okay',
        headers: {},
        body: 'Okay'
    }, 'description')
    okay(arrayed([ 598 ]), {
        statusCode: 598,
        description: 'Unknown',
        headers: {},
        body: 'Unknown'
    }, 'unknown code')
    okay(arrayed([ 200, { 'Set-Cookie': 'Name=Value' }]), {
        statusCode: 200,
        description: 'OK',
        headers: { 'Set-Cookie': 'Name=Value' },
        body: 'OK'
    }, 'headers')
    okay(arrayed([ 200, { 'content-type': 'text/plain' }, 'hello, world' ]), {
        statusCode: 200,
        description: 'OK',
        headers: { 'content-type': 'text/plain' },
        body: 'hello, world'
    }, 'code, headers and body')
    okay(arrayed([ { 'content-type': 'text/plain' }, 'hello, world' ]), {
        statusCode: 200,
        description: 'OK',
        headers: { 'content-type': 'text/plain' },
        body: 'hello, world'
    }, 'headers and body')
    okay(arrayed([ 'hello, world' ]), {
        statusCode: 200,
        description: 'OK',
        headers: {},
        body: 'hello, world'
    }, 'body only')
    okay(arrayed([ 200, [ 'content-type: text/plain', 'split::::', 'bad' ] ]), {
        statusCode: 200,
        description: 'OK',
        headers: { 'content-type': 'text/plain', 'split': ':::'},
        body: 'OK'
    }, 'arrayed headers')
}
