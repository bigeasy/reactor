module.exports = 1;

var cadence = require('cadence')
var util = require('util')
var less = require('less')
var parser = new (less.Parser)
var path = require('path')

var extract = cadence(function (step) {
    parser.parse('@import "css/foo"; a { color: blue; }', step())
}, function (tree) {
    var imports = walk([], tree)
    console.log(util.inspect(imports, false, 3))
    imports.forEach(function (i) {
        var iter = i, parts = []
        while (iter) {
            parts.push(iter.value || iter.currentDirectory)
            iter = iter.currentFileInfo
        }
        parts.reverse()
        console.log({ parts: parts })
        console.log(path.resolve.apply(path, parts))
    })
})

extract(function (error) {
    if (error) throw error
})

function walk (imports, node) {
    if (node.rules) {
        node.rules.forEach(function (rule) {
            if (rule.path) {
                imports.push(rule.path)
                if (rule.root) {
                    walk(imports, rule.root)
                }
            }
        })
    }
    return imports
}
