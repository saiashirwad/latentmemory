# One Durable Object per user

Spiked 2026-10-17. The proof lives outside the repo in `/tmp/flashcards-do-check` (`src/UserLog.ts`, `src/worker.ts`, `alchemy.run.ts`). It ran under `alchemy dev`.

## Alchemy (beta.83)

- Declare the object with `Cloudflare.DurableObject<Self>()("UserLog", Effect.gen(...))`.
- The Worker binds it with `const users = yield* UserLog` and calls `users.getByName(userId)`.
- Every new class is SQLite-backed by default. Alchemy writes the `new_sqlite_classes` migration itself.
- Inside the object, `yield* Cloudflare.DurableObjectState`. `state.storage` is Effect-wrapped, and `state.raw` is the plain workerd state.
- Local dev persists to `.alchemy/local/<script>-UserLog/*.sqlite`.
- Alchemy's `alchemy/SQL` has no Durable Object layer.

## Effect SQL

- `@effect/sql-sqlite-do@4.0.5` exists, with peer `effect ^4.0.5`.
- `SqliteClient.layer({ storage: ctx.storage })` provides `SqlClient`. `SqliteMigrator` is included.
- Pass the whole `storage`, not just `sql`. Otherwise `withTransaction` fails.
- Concurrent sibling transactions are unsupported.
- **Read, not run.** Everything above comes from reading the package source and types. It needs a real run before we rely on it.

## Measured locally

- **FTS5 works.** Creating the table, inserting and running `match` all worked. Unconfirmed on a deployed object.
- **`storage.transactionSync` is atomic.** One transaction appended an event, inserted into FTS and updated a count. A throw inside it rolled back all three.
- **Data persists** across requests to the same `getByName("user-1")`.

## Not yet run (needs a real test before we rely on it)

- A real deploy and its migration.
- `idFromName` behind auth.
- `@effect/sql-sqlite-do` at runtime.
