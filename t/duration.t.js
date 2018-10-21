require('proof')(2, prove)

function prove (okay) {
    var duration = require('../duration')
    okay(duration([ 0, 1 ], [ 0, 2 ]), [ 0, 1 ], 'ns greater than')
    okay(duration([ 0, 1 ], [ 1, 0 ]), [ 0, 999999999 ], 'ns less than')
}
