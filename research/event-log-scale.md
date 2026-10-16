# Event log scale on Cloudflare

Researched 2026-10-17. Question: does a whole-app event log, partitioned by user, scale past one user on D1?

## Our load

- A heavy user does 200 reviews/day: about 73k Reviews a year, or 80k events including Undo and Reset.
- A 2,000-card collection averages about 40 events per card per year. Mature cards have far fewer.
- At about 300 bytes per event including indexes, that's about 25 MB a year per heavy user.

## Limits

- **D1.** 10 GB per database, and this can't be raised. It is single-threaded: about 1,000 queries/s at 1 ms per query. Paid plans allow 50,000 databases per account, but only about 5,000 bindings per script. `batch()` is atomic, and there are no interactive transactions. Writes cost $1 per million rows after the first 50M a month; index writes count as rows. https://developers.cloudflare.com/d1/platform/limits/
- **Durable Objects with SQLite.** 10 GB per object, about 1,000 requests/s per object (a soft limit), single-threaded. https://developers.cloudflare.com/durable-objects/platform/limits/
- Cloudflare lists two ways to isolate customers' data, one database per customer or row-level, and doesn't recommend either. https://developers.cloudflare.com/use-cases/saas/data-isolation/

## Verdict

One shared D1 handles a lot of users before it breaks.
- **Writes.** 10,000 heavy users is about 2M reviews a day, or 23 writes/s on average. A single writer has room for that.
- **Storage.** The 10 GB cap holds about 400 heavy-user-years of events.

The cap and the single writer are what break first. When they do, move each user's log into its own Durable Object, which gives per-stream ordering for free, and keep D1 for queries that cross users.

## Snapshots

Not needed per card. Dudycz says stores cope with "several dozen or even more events" per stream, and calls snapshots a last resort. https://event-driven.io/en/how_to_do_snapshots_in_marten/

## Pitfalls

- A bare `ON CONFLICT DO NOTHING` can hide a real version conflict when there is a second unique key, such as `(stream, version)`. Check the expected version explicitly.
- Global sequence numbers have gaps, because ignored inserts still use up numbers. Never assume they're contiguous.
- Events from devices that sync offline arrive out of order. Replay them in `reviewedAt` order, not in arrival order.
