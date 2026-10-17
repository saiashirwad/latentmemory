# One Durable Object per user

Spiked 2026-10-17. Three proofs live outside the repo:

- `/tmp/flashcards-do-check` (`src/UserLog.ts`, `src/worker.ts`, `alchemy.run.ts`), run under `alchemy dev`.
- The local `@effect/sql-sqlite-do` probe in [#1](https://github.com/saiashirwad/latentmemory/issues/1), harness at `/private/var/folders/_f/yb2trsh50c1gv2dpybhtbw7r0000gn/T/opencode/alchemy-probes-59MuWQ/local-do`.
- The real-Cloudflare probes in [#2](https://github.com/saiashirwad/latentmemory/issues/2) and [#3](https://github.com/saiashirwad/latentmemory/issues/3), both throwaway Workers, since destroyed.

## Alchemy (beta.83)

- Declare the object with `Cloudflare.DurableObject<Self>()("UserLog", Effect.gen(...))`.
- The Worker binds it with `const users = yield* UserLog` and calls `users.getByName(userId)`.
- Every new class is SQLite-backed by default. Alchemy's provider logs reported `newSqliteClasses` on deploy; the exact upload wire field was not proven ([#3](https://github.com/saiashirwad/latentmemory/issues/3)).
- Inside the object, `yield* Cloudflare.DurableObjectState`. `state.storage` is Effect-wrapped, and `state.raw` is the plain workerd state.
- Local dev persists to `.alchemy/local/<script>-UserLog/*.sqlite`.
- Alchemy's `alchemy/SQL` has no Durable Object layer.

## Effect SQL

- `@effect/sql-sqlite-do@4.0.5` exists, with peer `effect ^4.0.5`.
- `SqliteClient.layer({ storage: ctx.storage })` provides `SqlClient`. `SqliteMigrator` is included.
- Pass the whole `storage`, not just `sql`. Otherwise `withTransaction` fails.
- Concurrent sibling transactions are unsupported.
- **Run locally (measured, [#1](https://github.com/saiashirwad/latentmemory/issues/1)).** Verified in a real local SQLite-backed DO under Miniflare `4.20260730.0` / workerd `1.20260730.1`, compatibility date `2026-07-30`, with `@effect/sql-sqlite-do@4.0.5` and `effect@4.0.5`. The working client shape is:

```js
import * as SqliteClient from "@effect/sql-sqlite-do/SqliteClient"
import * as Migrator from "@effect/sql-sqlite-do/SqliteMigrator"

const layer = SqliteClient.layer({ storage: ctx.storage })
ctx.blockConcurrencyWhile(() =>
  Effect.runPromise(Migrator.run({ loader }).pipe(Effect.provide(layer))),
)
```

- Passing `{ db: ctx.storage.sql }` instead of `{ storage: ctx.storage }` rejected `withTransaction`; its attempted insert did not run.
- Verified through worker → DO → adapter → workerd SQLite: two startup migrations and their ledger; a rerun returning `[]`; `withTransaction` committing to both an ordinary table and an FTS5 table; a deliberate failure rolling back both inserts; a failing third migration rolling back its `CREATE TABLE`, row and ledger entry; FTS5 `MATCH` excluding rolled-back content; a separate object ID starting empty; and data plus ledger surviving an emulator restart.
- Harness: `/private/var/folders/_f/yb2trsh50c1gv2dpybhtbw7r0000gn/T/opencode/alchemy-probes-59MuWQ/local-do`. Run `npm ci && npm run probe`; it clears only its own `state/` directory.
- **Implementation note.** The fixture creates a layer per request. Real code should share an object-lifetime client/runtime instead.
- Nested transactions, interruption and concurrent sibling transactions were not tested.

## Measured locally

- **FTS5 works.** Creating the table, inserting and running `match` all worked, locally and on a deployed object (see below).
- **`storage.transactionSync` is atomic.** One transaction appended an event, inserted into FTS and updated a count. A throw inside it rolled back all three.
- **Data persists** across requests to the same `getByName("user-1")`.

## Measured on real Cloudflare (2026-10-17)

- **FTS5 on a deployed DO ([#2](https://github.com/saiashirwad/latentmemory/issues/2)).** An isolated Alchemy `2.0.0-beta.83` / Effect `4.0.5` Worker created `cards USING fts5(front, back)`, inserted one synthetic row, and ran `SELECT rowid, front, back FROM cards WHERE cards MATCH 'sqlite'`. The same result came back before and after redeploying to add a second DO class. Cloudflare's namespace API reported `useSqlite: true`; the existing DO's row and marker survived the additive deploy.
- **Class migration ([#3](https://github.com/saiashirwad/latentmemory/issues/3)).** Deployed `ProbeA`, invoked a named instance, wrote a marker and an FTS5 table. Then added `ProbeB` with the same local Alchemy state, stack, stage and Worker name. The Worker ID and `ProbeA` namespace ID were unchanged; `ProbeB` was a new `useSqlite: true` namespace. A second request read `ProbeA`'s existing marker, repeated the FTS5 match, and created/read a table in `ProbeB`.
- Both probes used separate Workers with synthetic data. No application stack, D1, Website or real user data was deployed. Cleanup was verified through the Cloudflare API: Worker absent, neither namespace ID remaining.

## Not yet run (needs a real test before we rely on it)

- **The combination:** `@effect/sql-sqlite-do` inside a deployed DO. The adapter is verified locally; the deployment is verified separately, not together.
- `idFromName` behind auth.
- Concurrency and production scale; nested transactions and interruption.
- Preview, rename, removal, transfer, legacy-KV conversion and rollback of DO classes.
- A real `search_cards` implementation, ranking, tokenizer options and `MATCH` behaviour at scale.
