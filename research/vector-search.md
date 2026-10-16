# Vector search

Researched 2026-10-17. Scale: single user, hundreds to ~5,000 cards, ~50 queries/day. At this size FTS5 does most of the job. Embeddings add paraphrase matching, not new capability.

## Verdict

Keep FTS5. Don't add embeddings yet.

- **Now.** FTS5 + the `search_cards` tool. Good enough for exact-ish duplicates and keyword search.
- **When it hurts.** Paraphrase duplicates slip through ("define FSRS stability" vs "what does S mean in FSRS"). Then add embeddings.
- **If you add them.** Brute force in D1 or a Durable Object first. Vectorize only if you want managed ANN or a bigger corpus.

Candid point: Vectorize writes are not read-your-writes (see below). Claude often creates several cards in one burst. A card just inserted may be invisible to the duplicate check. Brute force over D1 rows avoids that.

## Vectorize

| Topic                     | Value                                                                                                                  | Status                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Stored dims               | Free 5M incl. · Paid 10M incl., then $0.05 per 100M                                                                    | Verified                             |
| Queried dims              | Free 30M/mo incl. · Paid 50M/mo incl., then $0.01 per M                                                                | Verified                             |
| No charge for             | CPU, memory, index count, empty indexes, egress                                                                        | Verified                             |
| Max dims                  | 1,536 (float32)                                                                                                        | Verified                             |
| Max vectors per index     | 20,000,000                                                                                                             | Verified                             |
| Metadata per vector       | 10 KiB; 10 metadata indexes per index                                                                                  | Verified                             |
| topK                      | 50 with values/metadata, 100 without                                                                                   | Verified                             |
| Namespaces per index      | 50,000 paid / 1,000 free                                                                                               | Verified                             |
| QPS limit                 | Not published                                                                                                          | Verified (absent)                    |
| Insert visible to query   | Write is durable on WAL at once. Query visibility needs an async job. No stated gap.                                   | Partly verified                      |
| Duplicate ID on insert    | Insert: first wins. Upsert: last wins.                                                                                 | Verified                             |
| Local dev (`alchemy dev`) | Not mentioned in docs read                                                                                             | Unverified                           |
| Alchemy resource          | Docs exist (Cloudflare.Vectorize.Index, SearchIndex binding, MetadataIndex). Naming differs between alchemy.run pages. | Unverified against installed version |

Metadata filters need a metadata index on the property before insert. Only vectors inserted after that are filterable.

Cost at our scale is effectively $0. 5,000 × 768 is 3.8M stored dims, under the 10M free. 1,500 queries/mo × 768 is about 1.2M queried dims, under 30M.

## Embedding models on Workers AI

| Model                            | Dims       | Max input  | Price                      | Status                |
| -------------------------------- | ---------- | ---------- | -------------------------- | --------------------- |
| `@cf/baai/bge-base-en-v1.5`      | 768        | 512 tokens | $0.0666 per M input tokens | Verified              |
| `@cf/baai/bge-small-en-v1.5`     | 384        | not read   | $0.020 per M input tokens  | Verified (price only) |
| `@cf/baai/bge-large-en-v1.5`     | 1024       | not read   | not read                   | Verified (dims only)  |
| `@cf/google/embeddinggemma-300m` | not stated | not stated | not stated                 | Unverified            |
| `@cf/qwen/qwen3-embedding-0.6b`  | not read   | not read   | not read                   | Unverified            |

Workers AI free allocation: 10,000 neurons/day. Overage $0.011 per 1,000 neurons. Embedding models bill per input token.

Embedding all 5,000 cards once (about 100 tokens each, 500k tokens) costs about $0.03 on bge-base. Query embeddings are negligible.

## D1 and the alternatives

- **D1 extensions.** Official list: FTS5 (plus `fts5vocab`), JSON, math functions. No vector extension listed. sqlite-vec is not on the list. Treat it as unavailable. Unverified beyond the docs list.
- **Brute force in D1.** Store each embedding as a Float32 BLOB (768 × 4 = 3 KB per row, under the 2 MB row limit). Read all rows, dot-product in the Worker. Computed, not benchmarked:
  - Storage: 5,000 × 3 KB ≈ 15 MB.
  - Rows read per query: 5,000. Paid includes 25B/mo, so this is free. At 50 queries/day that's 250k rows/day, under the Free 5M/day cap.
  - Transfer: about 15 MB out of D1 per query. This is the real latency cost, not the math.
  - CPU: ~4M multiply-adds per query. Likely tens of ms in JS (estimate). Free Workers get 10 ms CPU per request, so this needs Paid (default 30 s, max 5 min).
- **Durable Object SQLite.** Same brute-force shape, but the vectors live next to the compute. Avoids the 15 MB transfer. More moving parts. Not read in depth.

## Is it worth it?

| Use                            | FTS5 alone                               | With embeddings                                                 |
| ------------------------------ | ---------------------------------------- | --------------------------------------------------------------- |
| (a) near-dup on create         | Catches same wording and shared keywords | Catches paraphrases. Real gain, but small at hundreds of cards. |
| (b) semantic `search_cards`    | Keyword match only                       | Real gain for "the card about X" phrasing                       |
| (c) related cards / clustering | Not really                               | Yes, but no concrete need yet                                   |

Cost is not the blocker. Complexity and the write-visibility gap are. Embedding also means a model choice, a re-embed path when you switch models, and a sync step on every card edit.

## When to switch

- **Switch to brute force** when FTS5 misses real duplicates twice in a month, or you want semantic search in the MCP tool.
- **Move to Vectorize** if the corpus passes ~20k cards, or you want ANN instead of a full scan.
- **Don't** embed just for clustering until you have a use for the clusters.

## Sources

- https://developers.cloudflare.com/vectorize/platform/pricing/
- https://developers.cloudflare.com/vectorize/platform/limits/
- https://developers.cloudflare.com/vectorize/best-practices/insert-vectors/
- https://developers.cloudflare.com/vectorize/best-practices/query-vectors/
- https://developers.cloudflare.com/workers-ai/models/
- https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/
- https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/d1/sql-api/sql-statements/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://alchemy.run/providers/cloudflare/vectorize/
- https://v2.alchemy.run/blog/2026-05-31-beta-46/
- https://github.com/asg017/sqlite-vec
