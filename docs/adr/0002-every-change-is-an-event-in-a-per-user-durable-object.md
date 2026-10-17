---
status: accepted
---

# Every change is an event in a per-user Durable Object

Supersedes ADR 0001. Every change to a Card, not just its Reviews, is appended once to its user's log and never rewritten. Cards, Schedules and the search index are folds over that log. Each user's log and read models live in their own SQLite Durable Object, reached with `getByName(userId)` after the Worker authenticates. D1 keeps only auth. The PWA keeps its own copy of the log and folds it with the same `packages/domain` code, so Reviews work offline and nothing waits on the network. Ids are made on the device, and the object orders entries and rejects invalid ones. A Review is recorded the moment the Grid is tapped. Its Transcript arrives later as its own event, and Gradings are a throwaway cache, so the grader never blocks a Review or anchors an Assessment.

## Considered Options

- **One shared D1 log.** It lasts a long way (`research/event-log-scale.md`), but moving out later is a re-architecture, and D1 has no transactions.
- **A mutable cards table next to a review-only log.** Two ways to sync and two replay stories.
- **A Suggestion shown on the Grid before the Assessment.** It would anchor the Assessment and make the Review wait on the network.

## Consequences

- Stored events are never rewritten. A shape change may only add a variant inside an event or add a new event tag. Anything else is a new tag plus a decoder that upgrades the old one.
- A change to `ratingOf` or FSRS refolds Schedules one Card at a time. A full rebuild builds new tables in chunks next to the live ones and swaps them in one transaction, so no request waits on it.
- Phone and laptop can disagree for a few seconds.
