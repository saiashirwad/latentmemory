# D1 + Effect SQL + Alchemy

Read from `alchemy@2.0.0-beta.83`, `effect@4.0.5`, `@effect/sql-d1@4.0.5` source and the Cloudflare docs, 2026-10-17. Snippets are unrun unless noted.

## Imports

SQL is stable at `effect/sql` in Effect 4. `@effect/sql` is the Effect 3 line, don't use it.

```ts
import { SqlClient, SqlSchema, SqlResolver, SqlModel } from "effect/sql"
import * as Cloudflare from "alchemy/Cloudflare"
import * as SQL from "alchemy/SQL/D1"
```

## Wiring

```ts
export const Db = Cloudflare.D1.Database("Db", { migrations: "./migrations" })

// Worker init, provided with Cloudflare.D1.QueryDatabaseBinding
const d1 = yield* Cloudflare.D1.QueryDatabase(Db)
const SqlLive = SQL.D1Layer(d1, {
  transformResultNames: String.snakeToCamel,
  transformQueryNames: String.camelToSnake,
})
```

`D1Layer` provides `SqlClient` and `D1Client`. Repositories `yield* SqlClient.SqlClient`. Anything that batches `yield* D1Client.D1Client`. The client is built lazily and memoized per request.

## What works

- `SqlSchema.findAll / findOne / findOneOption / findNonEmpty / void`: Schema-encoded requests, decoded rows.
- `SqlResolver`: batches into one `IN (...)`. Chunk past 100 keys.
- `SqlModel.makeRepository`: insert/update/findById/delete with `RETURNING`.
- FTS5 and JSON functions. FTS5 shadow tables count toward row writes.

## What doesn't

- **No transactions.** `sql.withTransaction` is `Effect.die("transactions are not supported in D1")`. A defect, not a typed error.
- **No Effect `Migrator`.** It runs through `withTransaction`. Alchemy owns migrations: `.sql` files in `./migrations`, applied in order on deploy and in `alchemy dev`, tracked in `__alchemy_migrations`. Keep each one small.

## Batch is the atomic unit

"Batched statements are SQL transactions." One failure rolls back the lot.

```ts
readonly batch: <const S extends ReadonlyArray<Statement<any>>>(statements: S) =>
  Effect<{ readonly [K in keyof S]: Effect.Success<S[K]> }, SqlError>
```

Pass un-run statements. Results come back per statement, in order. A statement that changes zero rows is not a failure, so it won't roll anything back.

## Limits

| | |
|---|---|
| DB size | 10 GB paid, 500 MB free |
| Row / string / BLOB | 2 MB |
| Statement length | 100 KB |
| Bound params per query | 100 |
| Queries per invocation | 1,000 paid, 50 free |
| Query duration | 30 s, a batch counts as one |
| Columns per table | 100 |
| Time Travel | 30 days paid, 7 free |

Foreign keys are enforced. `PRAGMA defer_foreign_keys = on` lasts one batch. Read replicas need `db.withSession(...)` and bookmarks; skip them for now.

## Where we need atomicity

The rule: `review_log` is append-only and the source of truth. Card scheduling columns are a cache, written in the same batch.

- **Record a review.** Batch `INSERT INTO review_log ... ON CONFLICT(id) DO NOTHING` with `UPDATE cards SET ... version = version + 1 WHERE id = ? AND version = ? RETURNING id`. No row back means a conflict. Gate the insert on the same version check, or accept the log as truth and replay.
- **Create card + tags.** Client-generated ids. Batch the card insert, `INSERT OR IGNORE` tags, then `card_tags`. Pass tags as one JSON param through `json_each(?)` to stay under 100 params.
- **Undo.** Append a compensating event and replay the card.
- **Offline sync.** The review id is the idempotency key. `INSERT ... ON CONFLICT(id) DO NOTHING RETURNING id`; nothing back means a replay. Replay the card in `reviewed_at` order so out-of-order arrival converges.

## Testing

Repositories only need `SqlClient`, so most tests run against in-memory SQLite (`@effect/sql-sqlite-node`) with the same migration files. A small suite covers `batch` on real D1 through Alchemy's local workerd simulator (`alchemy dev`, data under `.alchemy/local/d1`). The vitest wiring is unverified.

## Sources

- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/best-practices/read-replication/
- https://developers.cloudflare.com/d1/sql-api/sql-statements/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://alchemy.run/cloudflare/data/d1/
