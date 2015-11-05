[![Build Status](https://travis-ci.org/bigeasy/reactor.svg?branch=master)](https://travis-ci.org/bigeasy/reactor) [![Coverage Status](https://coveralls.io/repos/bigeasy/reactor/badge.svg?branch=master&service=github)](https://coveralls.io/github/bigeasy/reactor?branch=master)

An asynchronous work queue. Reactor takes work and feeds it to an asynchronous
function that accepts an error-first callback.

Reactor is part of the [Cadence](https://github.com/bigeasy/cadence) Universe.
It is designed with Cadence in mind, but you can use it with your own eror-first
callbacks, just follow the rules.

Reactor is based on [Turnstile](https://github.com/bigeasy/turnstile) so it can
perform parallel operations in an orderly fasion;

 * with a runtime adjustable limit on the number of concurrent operations,
 * with a fifo queue that can be measured and monitored instead of using the
 event loop as an implicit queue,
 * with a mechanism to actively time out messages in the queue that have grown
 stale.

Without a queue, parallelism is unmanagable.

Here's an example of how to use Reactor to process a queue managed by Reactor.

```javascript
function Service (processor) {
    this._processor = processor
}

Serivce.prototype.serve = function (status, value, callback) {
    if (status.timedout) {
        console.log('timed out: ' + value)
        callback()
    }  else {
        this._processor.process(values, callback)
    }
}
```

The first argument to your callback function is going to be a status object.
The most interesting property of that object is going to the `timedout`
property, which will be `true` if the time since the work was sitting in the
queue for too long. If your work has timed out, return as soon as possible.
Otherwise, do your work.

Now you can create a Reactor and push work into your Reactor.

```javascript
var service = new Service(processor)
var reactor = new Reactor({ object: service, method: 'serve' })
reactor.push({ item: 1 }, function () {
    console.log('item consumed')
})
reactor.push({ item: 2 })
```

You can either push and wait, or else you can push and forget. To push and wait,
provdie a callback. It will be called when the work has been consumed. To push
and forget, just submit your work and move on.

There are some times when you want to keep a queue outside of the Reactor,
either you have some special grouping or gathering you want to perform, of else
you want to check an external source for work. In this case you would use
Reactor as a set of items to check.

Let's create a service that pulls work from a database.

```javascript
var database = require('database')

function Service (processor) {
    this._processor = processor
}

Serivce.prototype.serve = function (status, key, callback) {
    if (status.timedout) {
        console.log('timed out: ' + value)
        callback()
    }  else {
        database.get(key, function (error, value) {
            if (error) conosle.log(error.stack)
            else if (value == null) callback()
            else this._processor.process(value, callback)
        })
    }
}
```

In the above we use a key to pull a value from the database. If the value does
not exists in the database, then return immediately, but if it does we call the
processor with the work.

Let's put work in the database and flag

```javascript
var database = require('database')
var service = new Serivce(processor)
var reactor = new Reactor({ object: service, method: 'serve' })

database.add('a', { item: 1 }, function (error) {
    if (error) throw error
    reactor.set('a')
})
```

No matter how man times you call check with the value 'a', you will only be
adding one work entry into the queue for the value 'a'. The `check` method will
not add another entry into the work queue for the value 'a' until the current
entry is consumed by the work method.

Reactors create a separate asynchronous stack in which to do your work. Within
that stack, you're supposed to handle any errors. There is no way for any
asynchronous error or thrown exception to propagate out to the method that
called `push` or `check`. If an asynchronous error is returned to the callback,
Reactor will raise an uncatchable exception garauneteed to unwind your program.

The garunetee is a Good Thing. It means that you won't swallow errors, you won't
have exceptions caught by overly clever error handlers and fed to some event
handler you know nothing about.

If you are using an intelligent error-first control library like Cadence (or
Streamline.js), then it is easy to wrap your work in an asynchronous try/catch
block and recover if if you can, or log and continue.

*TK: Cadence receipes; try/catch, parallel waits.*

#### `new Reactor(operation, [turnstile])`

Create a new Reactor with an `operation` which is either an asynchronous
function or an object with an `object` and `method` property.

#### `reactor.push(work, [callback])`

Push work into the queue. If given a `callback`, the callback will be called
when the work is cosumed. The `callback` will never return value because errors
do not propagate up and out of the work queue.

Do not mix with `set` and `check`.

#### `reactor.set(key, [callback])`

Add a single item of work the work queue that will call the worker with optional
key. If given a `callback`, the callback will be called when the work is
cosumed. The `callback` will never return value because errors do not propagate
up and out of the work queue.

Do not mix with `push` and `check`.

#### `reactor.check([callback])`

Adds a single, undistinquished work entry into the work queue if no such entry
already exists. If given a `callback`, the callback will be called when the work
is cosumed. The `callback` will never return value because errors do not
propagate up and out of the work queue.


Do not mix with `push` and `set`.
