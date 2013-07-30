var cadence = require('cadence')

// okay, well a dependency woudl be either a file name, or a URL. Without a
// scheme we assume a file path. The only scheme that makes sense though is HTTP
// or HTTPS, maybe FTP, but are you really going to want to touch an FTP server
// as part of a build.
//
// Then it propagates an event.


function Artifact () {
}

Artifact.prototype.make = function () {
}

Artifact.prototype.dependencies = function (){
}

function Application () {
}

// too difficult, what is actually simple?

function Catenate (file, files) {
    this._file = file
    this._files = files
}

// cool, so when a component is rebuild, we remove it, then have it re-register
// itself, right?
Catenate.prototype.register = cadence(function (step, registrar) {
    var artifact = registrar.artifact(this._file)
    this._files.forEach(artifact.depends.bind(artifact))
})

function Project () {
}

Project.prototype.register = cadence(function (step, registrar) {
    step(function (component) {
        component.register(registrar, step())
    })(this._components)
})

// I'm seeing an array of functions. They are called and return expired, true or
// false. If they are expired, they are removed from the array, or whatever sort
// of collection we have, maybe a tree, maybe linked list. Probably an array.
//
// Inside the function is an array that has a boolean, if it flips to false,
// this is expired. Otherwise there is some sort of a test. These are the tests
// that need to be tickled, like stats or gets.
//
// Most targets are going to have a build step that hoovers in all that's
// needed, like LESS or browserify. Adding a dependency reporting step will
// ensure that they are only run as needed.


function Reactor () {
}

Reactor.prototype.rule = cadence(function (step) {
    step(function () {

    })
})

function Trigger () {
}
Trigger.prototype.x = function () {
}

function Builder () {
}

Builder.prototype.rebuild = function () {
}

// How do I say I want to build something?

function reactor () {
}

// targets and dependencies, plus a function to build them. We might want to
// glob targets, but if they've not yet been built, well, glob, then transform.
// Let's use LESS as an example.
//
// We might say that all `%.less` in a particular directory become public
// `%.css` in another directory. The `%.css` are built by transforming the
// `%.less` to `%css` though the less compiler. The name of the `%.css` file is
// the same as the `%.less` file except for the extension.
//
// The `%.less` files might contain dependant less files. We don't want to
// compel the user to specify these depedencies in the language the way it's
// done in Make. Why not? Well, becuase Make assumes a UNIX environment where
// the command line program builds each artifact from dependencies specified on
// the command line. Well, actually, that doesn't even work well for Make and
// it's primary task, building C programs, because header files are many and
// devined by the C compiler, there's actually some sort of dependency
// generation step with complicatd C builds as well.

module.styles = function (registrar) {
    var artifact = registrar.artifact()
}
