var explode = module.exports = function (object, key, value) {
    switch (typeof value) {
    case 'object':
        if (value == null) {
            var exploded = null
        } else if (value instanceof Error) {
            var exploded = {}
            Object.getOwnPropertyNames(value).forEach(function (property) {
                explode(exploded, property, value[property])
            })
        } else if (Array.isArray(value)) {
            var exploded = []
            for (var i = 0; i < value.length; i++) {
                if (value[i] == null || typeof value[i] == 'function') {
                    explode(exploded, i, null)
                } else {
                    explode(exploded, i, value[i])
                }
            }
        } else {
            var exploded = {}
            for (var property in value) {
                explode(exploded, property, value[property])
            }
        }
        object[key] = exploded
        break
    case 'function':
    case 'undefined':
        break
    default:
        object[key] = value
        break
    }
}
