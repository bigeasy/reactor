# Reactor Diary

Currently, trying to sort out how make reactor a work queue. Do you push work on
a queue, or simply tell it to start running?

We could make it the case that, if you push an array, it is work, if you push
anything but an array, it is a value passed.

Or we could have a function named `set`, and differentiate that from push.

The interface I'm looking for is something like...

```javascript
// values obtained somewhere else.
reactor.check('key')
// values pushed into queue, chunked by key.
reactor.push('key', [ 1, 2, 3 ])
// no key?
reactor.check()
reactor.push([ 1, 2, 3 ])
// wait for callbacks.
reactor.check(async())
reactor.check('key', async())
reactor.push([ 1, 2, 3 ], async())
```
