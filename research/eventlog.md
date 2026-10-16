# Effect EventLog

Read from `effect@4.0.5` source (`src/eventlog`, 7k lines) and spiked, 2026-10-17. Verified means read in source or run. Inferred means reasoned, not run. Spike code is in `scratchpad/eventlog-spike`.

## Verdict

Don't adopt it. Borrow three ideas and keep our own D1 tables. It is every layer we'd need to bend: a journal API that owns entry ids, a server that needs interactive transactions and a long-lived socket, and payloads stored as opaque binary.

## What it is

Import path is `effect/eventlog`, in the package exports map. Every module is `@stability unstable`.

```ts
import { EventGroup, EventLog, EventJournal, EventLogRemote,
  EventLogServerUnencrypted, EventLogEncryption } from "effect/eventlog"
```

| Module | Role |
|---|---|
| `Event`, `EventGroup` | Schema-defined events. `EventGroup.empty.add({ tag, primaryKey, payload, success, error })`. |
| `EventLog` | Client service. `schema(...groups)`, `group(group, h => h.handle(tag, fn))`, `makeClient(schema)`, `Registry`, `Identity`. |
| `EventJournal` | Local storage service. `makeMemory`, `makeIndexedDb`. |
| `SqlEventJournal` | Same service over any `SqlClient`. |
| `EventLogRemote` | Client side of sync. `layerUnencrypted`, `layerEncrypted`. |
| `EventLogServerUnencrypted`, `EventLogServerEncrypted` | Server side. Plain or opaque ciphertext. |
| `SqlEventLogServerUnencrypted`, `SqlEventLogServerEncrypted` | SQL `Storage` for those servers. |
| `EventLogEncryption`, `EventLogSessionAuth` | AES-GCM, Ed25519 session auth. |
| `EventLogMessage` | RPC group (`EventLog.Hello`, `Authenticate`, `WriteSingle`, `WriteChunked`, `Changes`), chunking. |

Mental model, verified:

- An event is a tag, a Schema payload and a `primaryKey(payload) => string`.
- `makeClient(schema)("ReviewRecorded", payload)` encodes the payload to binary, runs the registered handler, then appends an `Entry { id, event, primaryKey, payload: Uint8Array }` to the journal.
- A handler is the projection. It updates your read model and returns the event's success value.
- Each remote has a sequence and a "missing" set. The client pushes entries the remote lacks and subscribes to `Changes` from `startSequence`.
- Incoming remote entries are deduped by id. Handlers run on the survivors with a `conflicts` list.
- A conflict is a journal entry with the same `event` and `primaryKey` and a later id.
- Compaction is optional. `groupCompaction(group, fn)` receives all entries per `primaryKey` and rewrites them.
- `groupReactivity` invalidates `effect/reactivity` keys when a handler runs.

```ts
export class Entry extends Schema.Class<Entry>("effect/eventlog/EventJournal/Entry")({
  id: EntryId, event: Schema.String, primaryKey: Schema.String, payload: Schema.Uint8Array
})
```

## Storage

- **Memory and IndexedDB journals exist.** The IndexedDB one has stores `entries`, `remotes`, `remoteEntryId`. Its `entries` is `getAll()` over the whole store. No paging, no trimming.
- **`SqlEventJournal` exists.** It is a client journal over any `SqlClient`, and its `withLock` is `sql.withTransaction`. On D1 that is a defect, per `d1-effect-sql.md`.
- **`SqlEventLogServerUnencrypted` is the server storage.** Tables are server id, per-store `next_sequence`, entries keyed `(store_id, sequence)`, and session auth bindings. Write path is `ensureStore`, then `lockStore` (`UPDATE ... SET next_sequence = next_sequence ... RETURNING` on sqlite), then insert, then `setNextSequence`.
- **That is a read-modify-write that needs `sql.withTransaction`.**

```ts
const result = yield* sql.withTransaction(
  Effect.provideService(restore(effect), pendingWrites, writes)
)
```

- **D1 has no interactive transactions, so this storage can't run on D1 (verified from source, inferred for D1 behavior).** A DO with SQLite storage could host it (inferred). I found no `sql-sqlite-do` client in this install.
- **Live push is in memory.** Subscribers hang off an `RcMap` of `PubSub` per store, published after commit. Isolates don't share it.
- **The Worker needs a persistent socket.** `Changes` is a streaming RPC. Session auth is stateful per connection.

## Transport (spiked)

`RpcServer.layerProtocolHttp` plus `RpcClient.layerProtocolHttp` failed in the first call. Hello and Authenticate land on different HTTP requests, so the challenge is gone.

```
ProtocolError: Session auth challenge has expired
```

Verified: plain HTTP RPC can't carry the handshake. Also the default `layerNdjson` serialization can't encode the `Uint8Array` challenge. Use `RpcSerialization.layerSchemaBinary()`.

Websocket works. Node server via `@effect/platform-node` `NodeHttpServer.layer`, `RpcServer.layerProtocolWebsocket({ path: "/rpc" })`, clients on `Socket.layerWebSocket` with the global `WebSocket`, `EventJournal.layerMemory`, in-memory `Storage`.

```
A handled a1 / a2     (offline writes, local handler)
server handled a2, a1, b1
B handled a2, a1      (fan-out from A)
A handled b1
A rows [a1,a2,b1]  B rows [b1,a2,a1]  server [a2,a1,b1]
```

Verified: define, write offline, sync up, fan out. Handlers run on the client at write time and again on the server.

Two surprises:

- **Same-millisecond order is random.** The server saw `a2` before `a1`. `v7Bytes` sets the timestamp and version bits and leaves the rest random. There is no counter.
- **The journal owns the entry id.** `makeEntryIdUnsafe()` is called inside `journal.write`. We can't pass our own `ReviewId`.

```ts
bytes[6] = (bytes[6] & 0x0f) | 0x70   // random tail otherwise
```

Replay order is `Entry.Order`, a byte compare of the id. For FSRS, same-instant reviews are rare but clock skew across devices is not. Our `reviewedAt` plus a tiebreak must decide order, not the library's id.

## Identity and multi-user

Verified:

- The client `Identity` is `{ publicKey, privateKey }`, generated on device by `EventLog.makeIdentity`.
- The session proves possession with an Ed25519 signature. The server binds `publicKey` to a signing key on first sight (`getOrCreateSessionAuthBinding`).
- The server hooks are `authorizeIdentity`, `authorizeWrite`, `authorizeRead` and `StoreMapping.resolve({ publicKey, storeId })`. Per-user access is yours to implement.
- **Encrypted mode.** The server stores AES-GCM blobs and never runs handlers. It can't answer `list_due` or `search_cards`. Unusable for us.
- **Unencrypted mode.** The server decodes each entry and runs the registered handlers, so it can project into queryable tables. Docs gotcha: "Entries are persisted and streamed in plaintext."
- A second app identity next to our GitHub login (yielded auth) would need a mapping `publicKey -> userId`. Inferred: doable, more state to own.

Server-side writes work too. `makeWrite(schema)({ storeId, event, payload })` signs as `effect-eventlog-server-write:<storeId>`. That is how an MCP `create_card` would append.

## Fit

| Need | EventLog |
|---|---|
| Append-only review log as truth | Yes, in shape. |
| Client-chosen idempotency key | No. Journal makes the id. Dedupe is by that id only. |
| Deterministic replay order | No. UUIDv7 with random tail. |
| Queryable on D1 | No. Payload is an opaque binary BLOB. A handler must project. |
| Atomic append plus projection on D1 | No. Needs `withTransaction`. D1 only has `batch`. |
| Worker only | No. Needs a socket and shared PubSub, so a DO. |
| Browser journal | Yes. IndexedDB exists. Full `getAll`, no paging. |
| Foldkit | Poor. Handlers, `Registry`, Reactivity and fibers sit beside the Model. State belongs in the Model and effects in Commands. |
| Stability | `@stability unstable` on every module. Binary payload format is unstable too. |

Its conflict model (`event` plus `primaryKey`, later id wins) solves a problem we don't have. Reviews are never edited. Our only conflicts are content edits, which `domain.md` already settles as last write wins.

## Recommendation

Borrow, don't adopt. All three are one table and one Schema each.

1. **Events as a Schema union.** One tagged union (`ReviewRecorded`, `CardCreated`, `Reset`, `UndoReview`), decoded at the boundary. `EventGroup` does this, but a plain `Schema.Union` is enough.
2. **Client-generated id plus idempotent append.** Client ULID is the primary key. Server inserts with `ON CONFLICT(id) DO NOTHING` in a `D1Client.batch`, as `domain.md` already says. Order replay by `(reviewedAt, id)`.
3. **A per-device sent-watermark.** EventLog's per-remote "missing" set, but in IndexedDB as a plain queue: rows not yet acknowledged. Server returns the authoritative schedule for touched cards.

Skip: identities and signatures (we have GitHub auth), the socket, binary payloads, handlers and the Registry, compaction, encryption.

Revisit if we want live multi-device push. That needs a DO anyway, and a DO with SQLite could host `SqlEventLogServerUnencrypted`. It would be a second source of truth beside D1. Not for v1.

## Sources

- `effect@4.0.5/src/eventlog/*.ts`: `EventLog`, `EventGroup`, `Event`, `EventJournal`, `SqlEventJournal`, `EventLogRemote`, `EventLogServer`, `EventLogServerUnencrypted`, `SqlEventLogServerUnencrypted`, `EventLogEncryption`
- `effect@4.0.5/src/internal/uuid.ts` (`v7Bytes`)
- `effect@4.0.5/src/rpc/RpcServer.ts`, `RpcClient.ts`, `RpcSerialization.ts`
- `@effect/platform-node@4.0.0` `NodeHttpServer`
- `research/d1-effect-sql.md`, `research/domain.md`
- https://effect.website/docs/v4/api/effect/eventlog/EventLog (not fetched, source read instead)
- Spike: `scratchpad/eventlog-spike/spike.ts` (HTTP, fails at handshake), `scratchpad/eventlog-spike/ws-spike.ts` (websocket, passes)
