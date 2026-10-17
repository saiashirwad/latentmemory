# Review choreography, async grading, and card anatomy

## 1. Zero-blocking reviews: reveal at 0ms, grade in the background

Voice transcription (`nova-3`, ~350–600ms) and grading (`Jev`, ~300–400ms) take ~700–1,200ms over the network. None of this should block the user during a review session.

- **Reveal the back at `0ms`** the instant the user finishes speaking (or taps Reveal).
- **Never block advancing to the next Card.** The user selects their `Assessment` on the `Grid` and moves immediately to the next Card.
- **Background enrichment without data loss:**
  1. When the review ends, the client immediately generates the `ReviewId` (UUIDv7) and records the `Review` locally (with `Assessment`, `Hesitation`, and the raw audio blob queued in IndexedDB if spoken).
  2. In the background—even while the user is already 2 Cards ahead—the audio uploads, `nova-3` produces the `Transcript`, and `Jev` produces the `Grading` and `Suggestion`, attaching them asynchronously to that `ReviewId`.
  3. Because the review log is append-only / idempotent per `ReviewId`, the user's synchronous `Assessment` is never delayed, and the async `Transcript` + `Grading` are never lost if the user moves fast or goes offline.
  4. Post-session (or on a subtle toast/review summary), any large discrepancy between the user's self-assessment and the grader's `Grading` (such as a flagged misconception or missed `KeyConcept`) can be surfaced as calibration feedback rather than an in-flow speed bump.

## 2. Avoiding the "Anchor Trap" on the Grid

Human beings under review fatigue take the path of least resistance. If a grader pre-places a pointer on `Understanding` and defaults `Effort` to `0.5` (neutral) with a separate "Next" button, the user will stop introspecting on `Effort` and just tap "Next"—turning `Effort` into dead data (`0.5, 0.5, 0.5...`).

- **No separate "Next" button.**
- **Single-tap spatial commit:** Tapping a point on the `Grid` both records the `Assessment` (`Effort` + `Understanding`) and advances to the next Card in a single gesture.

## 3. Seamless Voice + Silent review duality

Half of mobile spaced repetition happens on a train, in bed, in a coffee shop, or when your voice is tired. The `Grid` is the universal primitive; voice is an optional amplifier on every Card without modes or settings toggles.

- **Front screen has one primary zone:**
  - **Tap anywhere** → Silent Reveal (`Hesitation` = time from Front appearing to tap).
  - **Hold (or tap mic) to speak, release to reveal** → Voice Reveal (`Hesitation` = time from Front appearing to first word spoken; releasing immediately reveals the Back at `0ms` and fires the background transcription/grading pipeline).

## 4. `Motive` and `Excerpt` as weapons against "AI Slop Decks"

The #1 reason spaced repetition systems die when paired with automation is **collector's fallacy + context collapse**. It costs zero effort to tell an agent *"make cards from this session."* Weeks later, a Card comes due and feels like sterile trivia because you forgot *why you cared* or what bug burned you for two hours before learning the fact.

- **Include `Motive` in `Card` / `Source`** alongside `Excerpt`.
- When an MCP tool creates a Card from a conversation, require the agent to capture the **episodic anchor** (`motive`: e.g., *"Hit a D1 transaction error because SqlEventJournal calls withTransaction"*), not just encyclopedic Q&A.
- Showing `Motive` and `Excerpt` on the Back of the Card reconnects semantic memory (the rule) to episodic memory (the moment you lived it).

## 5. `KeyConcept` as a Card-authoring linter

Wozniak's and Matuschak's #1 rule of flashcards is **minimum information / atomic cards**.

- If a Card requires 5 or 6 `KeyConcept`s to grade, it is almost certainly a list or paragraph masquerading as a Card, and reviewing it will be miserable.
- **Make `KeyConcept`s part of the Card's anatomy at creation time:**
  1. Let the MCP `create_card` tool accept `keyConcepts` directly from the calling agent (which already has full conversation context and LLM intelligence, avoiding a second blind LLM extraction call on the server).
  2. Use the count as a linter: cap or warn when a Card has $>3$ `KeyConcept`s (*"If a Card needs 4+ key concepts, split it into multiple Cards"*).

## 6. Rethinking the 2D `Grid` to `Rating` mapping (`ratingOf`)

In a 2D space of `Effort` (x-axis, `0..1`) and `Understanding` (y-axis, `0..1`):
- `Easy` should require **both** high `Understanding` and low `Effort` (a top-left corner region, not a vertical stripe where `understanding = 0.41, effort = 0.1` gets `Easy`).
- High `Understanding` + high `Effort` (e.g., `understanding = 0.95, effort = 0.85`—*desirable difficulty*, where you worked hard for 8 seconds and reconstructed the whole answer accurately) should be distinguished from barely scraping by (`understanding = 0.45, effort = 0.85`).
- Because the append-only log stores the raw `{ effort, understanding }` `Assessment` (ADR 0001), `ratingOf`—or even a continuous FSRS adapter in the future—can evolve and replay without losing historical fidelity.
