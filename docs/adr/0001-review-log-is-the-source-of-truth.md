---
status: superseded by ADR-0002
---

# Reviews are an append-only log; Ratings and Schedules are derived

Each Review is appended once and never changed. It stores the Assessment the user left on the grid, plus the grader's Suggestion when there was one. FSRS Ratings and each Card's Schedule are worked out from the log and cached on the Card. They are never the record. This lets offline Reviews sync idempotently with ids made on the device, lets us change the Assessment-to-Rating mapping or fix FSRS and reschedule by replaying, and keeps the history clean for re-fitting FSRS weights later. The log lives in our own D1 tables. Appends and cache updates go in one `D1Client.batch`, because D1 has no interactive transactions.

## Considered Options

- **Store the Rating directly.** Simpler, but it throws away the grid position and freezes today's mapping into the data.
- **Effect's EventLog.** Its server needs transactions D1 lacks and a WebSocket host. It generates its own entry ids, and stores payloads as opaque blobs the MCP tools can't query. We kept its ideas: one Schema union of events, ids made on the device, idempotent append. See `research/eventlog.md`.
