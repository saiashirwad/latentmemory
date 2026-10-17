# Domain: spaced repetition

Researched 2026-10-17. The review log is the record we never lose. Each card's schedule is a cache rebuilt by replaying it.

## FSRS-6

Current version. FSRS-5 plus `w19` (same-day stability dependence) and `w20` (trained forgetting-curve decay). About 200 lines of pure TS.

Default weights:

```
[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
```

Ratings: Again 1, Hard 2, Good 3, Easy 4. G rating, S stability (days), D difficulty, R retrievability, t days since last review.

- **Retrievability.** `R(t,S) = (1 + FACTOR·t/S)^DECAY`, `DECAY = −w20`, `FACTOR = 0.9^(1/DECAY) − 1`.
- **Interval.** `I = S/FACTOR · (r^(1/DECAY) − 1)`, rounded, clamped to [1, 36500].
- **First review.** `S0 = w[G−1]`, `D0(G) = w4 − e^(w5·(G−1)) + 1` clamped to [1, 10].
- **Difficulty.** `ΔD = −w6·(G−3)`, `D' = D + ΔD·(10−D)/9`, `D'' = w7·D0(4) + (1−w7)·D'` clamped to [1, 10]. `D0(4)` here is unclamped.
- **Recall.** `S' = S·(1 + e^w8·(11−D)·S^(−w9)·(e^(w10·(1−R)) − 1)·hardPenalty·easyBonus)`. `w15` on Hard, `w16` on Easy, else 1.
- **Lapse.** `S' = min(w11·D^(−w12)·((S+1)^w13 − 1)·e^(w14·(1−R)), S / e^(w17·w18))`. The `min` is only in the code, not the wiki.
- **Same day.** `SInc = e^(w17·(G−3+w18))·S^(−w19)`, floored at 1 for Hard/Good/Easy. `S' = S·SInc`. Used whenever the last review was under a day ago.
- **Floor.** S ≥ 0.001.

States: New, Learning, Review, Relearning. Learning steps 1m and 10m, relearning 10m, desired retention 0.9.

- **Learning.** Again goes to step 0. Hard repeats the step. Good advances and graduates after the last step. Easy graduates.
- **Review.** Again goes to Relearning. Anything else schedules the next interval.

Fuzz applies in Review when I ≥ 2.5 days. `delta = 1 + 0.15·(days in 2.5..7) + 0.10·(days in 7..20) + 0.05·(days above 20)`. Pick uniformly in `[max(2, round(I−delta)), round(I+delta)]`. Seed it from the review id so replay is deterministic.

Golden-test against py-fsrs.

Re-optimizing weights later only needs `(cardId, rating, reviewedAt)` per review.

## Pitfalls

- **Day boundary.** Per-user timezone and rollover hour, default 4am. "Due today" means `due < next rollover`. Store the UTC instant per review.
- **Due.** Stored as a cache with an index on `(userId, due)`. Always rebuildable.
- **Editing.** Keep the schedule. "Reset progress" appends a Reset event.
- **Status.** Active, Suspended, Deleted. Delete is a soft tombstone; reviews stay. Burying waits for sibling cards.
- **Undo.** An event, then replay the card. Most recent review only.
- **Assessment → Rating is a guess.** `ratingOf` in `packages/domain/src/assessment.ts` uses 0.4 / 0.8 / 0.3 / 0.7 / 0.85. No real review data exists; [#7](https://github.com/saiashirwad/latentmemory/issues/7) was closed without validation. Store raw `{ effort, understanding }` and refit later. Likewise, hesitation → Effort is unvalidated ([#8](https://github.com/saiashirwad/latentmemory/issues/8)); don't infer Effort from response time.
- **Duplicates.** The real risk with AI-made cards. Store a hash of the normalized front, unique per user. `create_card` returns near matches from FTS5. The tool tells Claude to `search_cards` first. Embeddings later.
- **Notes vs cards.** Not yet. Make content a tagged union (`Basic` now, `Cloze` later) so `noteId` can arrive by migration.
- **New cards per day.** Essential, since Claude makes cards in bursts. Default about 10. Order reviews by lowest retrievability. Cap reviews per day.
- **Leeches.** Lapse count derived from the log. Threshold around 8 (unconfirmed).

## Writing good cards

Rules for the `create_card` tool description, from Matuschak and Wozniak:

1. One fact per card.
2. A precise question with one stable answer.
3. No yes/no questions, no fronts you'd recognize by shape.
4. Never ask for a list.
5. Several small cards per concept: causes, effects, contrasts, parts, why it matters.
6. Don't leak the answer in the question.
7. Tie it to the user's own context.
8. Search first. Avoid duplicates and confusingly similar cards.

Provenance per card: conversation URL and title, client (`claude.ai`, `claude-code`, …), the excerpt that triggered it, `createdVia` (`mcp` or `pwa`), tags, `createdAt`.

## Offline review

The PWA runs the same FSRS module so the next card is instant. Reviews queue in IndexedDB as `{ id (client ULID), cardId, rating, reviewedAt, durationMs }`.

- **Sync.** POST a batch. Server inserts with `ON CONFLICT(id) DO NOTHING`, replays affected cards in `reviewedAt` order, returns the authoritative schedule.
- **Two devices.** Keep both reviews. The second becomes a same-day review. No merge logic.
- **Clock skew.** Store `receivedAt`. Clamp `reviewedAt` to at most `receivedAt` and at least the card's `createdAt`.
- **Content edits.** Server-authoritative, last write wins.

## v1 sketch

```
UserId, CardId, ReviewId, ParamsId: branded

User { id, githubId, timezone, dayRolloverHour, newPerDay, reviewsPerDay,
       desiredRetention, activeParamsId }
FsrsParams { id, userId, weights: Tuple21, createdAt, source: "default" | "optimized" }
Card { id, userId, content: Basic { front, back }, tags, source, contentHash,
       status: Active | Suspended | Deleted { at }, createdAt, updatedAt }
Review { id, userId, cardId, rating, reviewedAt, receivedAt, durationMs?, paramsId }
CardSchedule = New
  | Learning { step, S, D, due, lastReview }
  | Review { S, D, due, lastReview }
  | Relearning { step, S, D, due, lastReview }
```

Derived, not stored: retrievability, reps, lapses, leech flag, due today, daily counts.

`userId` on every row and query from day one.

Later: weight optimizer, cloze and notes, semantic dedupe, load balancing, per-tag retention, card history, sharing.

## Sources

- https://github.com/open-spaced-repetition/py-fsrs
- https://github.com/open-spaced-repetition/ts-fsrs
- https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- https://andymatuschak.org/prompts/
- https://www.supermemo.com/en/blog/twenty-rules-of-formulating-knowledge
- https://docs.ankiweb.net/deck-options.html
- https://github.com/ankidroid/Anki-Android/wiki/Database-Structure
