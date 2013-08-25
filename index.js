module.exports = 1;

var util = require('util')
var less = require('less')
var parser = new (less.Parser)
parser.parse('@import "foo"; a { color: blue; }', function (error, tree) {
    if (error) throw error
    //console.log(parser.imports)
    //console.log(tree.toCSS())
    var imports = walk([], tree)
    console.log(util.inspect(imports, false, 3))
})

function walk (imports, node) {
    if (node.rules) {
        node.rules.forEach(function (rule) {
            if (rule.path) {
                imports.push(rule)
                if (rule.root) {
                    walk(imports, rule.root)
                }
            }
        })
    }
    return imports
}
