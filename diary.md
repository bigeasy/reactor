# Reactor Diary

Wrestling with whether to attempt to use libraries for all the parsers, or
whether to have a go at writing "parsers" that extract dependencies via regular
expressions, but I'm leaning toward the dependency heavy route. If I do go that
route, then I imagine I'm going to want to break the project up into a core
reactor project and dependencies.

## LESS

LESS is my first example. Here's what I've discovered.

There is a race condition. If you have a parser, or whatever we're going to call
it, that creates a list of files to stat while it parsers, like LESS, you get
the list after the artifact has been build by the parser. You've no idea if the
artifact is out of date now, because you have an artifact and a list of files,
but no time stamps for the files. While you're gathering time stamps for the
files, the files might change.

Okay. Given a system clock, you could take the machine time prior to running
your parser. Then, as you stat, if you find that one of the files has been
modified since, then you know to rerun everything.

Or, like `make`, you use the time stamp of the input file. This is not as
complicated as I thought it was. In fact, let that be the universal test. Like
make, are any of the dependencies newer than the output? What if the output is
in memory and has no file representation? Then, yes, use `Date.now()`.

When this is over, we have an output artifact, or a collection thereof, with an
output time stamp, and input resources each with their own artifact. We can now
perform a test to see if the output artifact needs to be rebuilt.

That test can be to stat all the upon which the artifact depends. That's kind of
rough though. We could use the file-system watch to get events when items in a
working directory change. If this is not available, then we can stat when the
resource is requested.

These are two ways of going about it; poll based on a resource, or else
triggering updates based on the notification of a change to a watched resource.

We can poll, no problem. We can watch using `fs.watch` no problem. Polling is a
fallback if we ever intend on using HTTP as a resource protocol. Their might be
a timeout, don't do a stat until a minute has passed, that sort of thing, for
applications outside of development reloads.

A resource is a path and a time stamp. Checking it is a matter of `stat`ing the
resource, seeing if it is newer than the given time stamp, or, maybe simply
`stat`ing the resource and seeing if it is newer than the target time stamp.

That's even easier. Why does the time stamp of resource matter anyway?

Now we have a grouping of dependencies, a resource that those dependencies
create, which can be a string, and we can easily poll through that grouping. How
do we notify the grouping of events? There needs to be a pool of resources,
those resources are keyed by resource path, and when the resource path changes,
it generates an event. The groupings are listeners. Let's call the grouping
targets, why not? Targets depend on resources.

Targets are identified by a string, but they can produce many artifacts. A
template might generate a collection of files, but it has a URL to identify it.
This means that this url, this resource path, it needs to be touched after it is
built, if we're using the actual artifact as a resource. I foresee using a
b-tree to store these resources in memory.

What is the upshot? You poll and find something is out of date, well I guess you
create a new one. What happens when you get an event that makes something out of
date? Do you build it and wait? I imagine then, that you want shared/exclusive
locks on an item. It seems like you would dispose of the old item, then put
forward a latch on the new item, so you don't have to wait for the readers of
the old item to finish before provisioning. Using a shared/exclusive lock, it
makes the shared locks seem less futile, since they would block an exclusive
update, but that's a latch for you. They're always going to feel like a burden
once they've been flipped.

Which means we have a target. That target has a time stamp. It can be preserved
between writes on the file system, but I like the idea of making this a Strata
joint. The target has however many dependencies. Either you poll them or you
wait on events.

## Race Conditions

While I'm considering all this, it seems that there are so many opportunties for
race conditions. As I've written this diary entry, I've resolved some of them.
