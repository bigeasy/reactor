require('proof')(2, prove)

function prove (okay) {
    var explode = require('../explode')
    var error = new Error
    error.code = 'ENOENT'
    var object = {
        child: {
            number: 1,
            errors: [ undefined, function () {}, error ],
            object: {
                f: function () {},
                undef: undefined,
                string: 'value'
            }
        }
    }
    explode(object, 'child', object.child)
    okay(typeof object.child.errors[2].stack, 'string', 'stack')
    delete object.child.errors[2].stack
    okay(object.child, {
        number: 1,
        errors: [ null, null, { code: 'ENOENT' } ],
        object: { string: 'value' }
    }, 'explode')
}
