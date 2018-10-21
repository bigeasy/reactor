var assert = require('assert')

module.exports = function (start, stop) {
    if (start[1] > stop[1]) {
        stop[0] --
        stop[1] += 1e9
    }
    var difference = [ stop[0] - start[0], stop[1] - start[1] ]
    assert(difference[0] >= 0 && difference[1] >= 0)
    return difference
}
