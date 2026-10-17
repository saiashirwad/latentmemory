# Humane design

Researched 2026-10-17. What history's humane designers would ask of this app, and where we stand on each question. Who they are and what to read is in `~/rabbitholes/humane-designers.md`.

## Questions and where we stand

- **Douglas Engelbart:** does reviewing make your own thinking stronger, or does the app think for you?
  - The app must never pre-empt your metacognition. If a grader pre-places a pointer on the Grid and offers a "Next" button, review fatigue turns you into a rubber-stamper (the *anchor trap*).
  - Resolution: You always assess your own `Effort` (subjective phenomenology) and `Understanding` (objective fidelity) first with a single tap on the Grid. The grader (`Jev`) runs asynchronously in the background as a non-blocking *calibration auditor*—only tapping you on the shoulder afterward when your self-assessment and its reading of the `Transcript` diverge (e.g., a flagged misconception or missed `KeyConcept`).
- **Bret Victor:** when the grader disagrees with your Assessment, can you see what it was looking at and argue with it?
  - Yes. When the background grader flags a discrepancy, it shows the `Transcript` alongside the exact `KeyConcept`s it saw as covered or missed, rather than an opaque score.
  - Because `Assessment` is already yours and `Grading` is a separate throwaway record on the `ReviewId`, the grader never overwrites your judgment; it makes the gap between what you *thought* you said and what you *actually* said visible.
- **Jef Raskin:** can you get lost in a mode (silent vs. voice, listening vs. revealing) without knowing which one you're in?
  - Resolution: **No modes, only a quasimode.** Raskin's cure for mode errors is physical tension (holding a key or button).
  - On the Front of a Card, tapping anywhere reveals silently (`0ms`). **Holding** the speak pill (or spacebar) records your voice; **releasing** immediately reveals the Back (`0ms`) and dispatches the audio to the background pipeline. Your thumb knows whether the mic is hot because it is physically holding the button down.
  - `Undo` is always one gesture away and appends a compensating entry rather than mutating history.
- **Don Norman:** what are the signifiers and immediate feedback when there is zero blocking latency?
  - Reveal happens at `0ms` on release/tap, and advancing happens at `0ms` on tapping the Grid—no spinners between cards.
  - While holding to speak, a live waveform/pulse signifies the mic is capturing. After you tap the Grid and move on, a quiet background status pill signifies that transcription/grading is settling in the background without stealing focus.
- **Ted Nelson:** can you follow a card back to where it came from?
  - Yes for web pages, through the WebPage `url`.
  - Conversations have no public URL, so they carry their literary and episodic provenance inside the Card via `Source`, `Excerpt` (the passage that triggered it), and `Motive` (why you cared in that moment).
- **Ink & Switch:** if your phone dies or you're on a train offline, does your history survive, and who holds it?
  - Yes. Reviews (and any recorded audio blobs waiting for transcription) queue locally in IndexedDB with client-generated `UUIDv7` ids and sync idempotently to your append-only log.
  - Raw `{ effort, understanding }` coordinates are the permanent record; `Rating` and `Schedule` are derived projections that can always be replayed.
- **Matuschak & Nielsen:** does a card stay tied to the explanation and lived struggle it came from, or does it rot into sterile, decontextualized trivia?
  - Yes, in two ways:
    1. **Episodic anchoring (`Motive` + `Excerpt`):** Reconnecting semantic memory (the rule on the Back) to episodic memory (the bug that burned you or the question you kept asking when the Card was made).
    2. **Structural atomicity (`KeyConcept` as linter):** A Card with $>3$ `KeyConcept`s is a paragraph masquerading as a prompt. Enforcing $1\text{–}3$ `KeyConcept`s at creation time keeps prompts sharp and prevents "AI slop decks."
- **Dieter Rams:** what does this do that a notes app can't, and what can we delete?
  - Delete the "Next" button: a single tap on the 2D Grid both commits the `Assessment` and advances to the next Card.
  - Delete the "Voice vs. Silent" mode toggle: tap to reveal silently, hold-and-release to speak and reveal.
  - Delete blocking loading states between Front, Back, and Next Card.
- **Christopher Alexander:** which recurring moments in a session deserve their own spatial and temporal pattern?
  - **The Threshold of Completion (Zeigarnik vs. Closure):** A review session is a *convergence loop* (closing open loops to zero). A parked rabbit hole (`ideas/rabbit-holes-in-reviews.md`) is a *divergence loop* (an invitation to explore). Never interrupt card #4 of 20 with a rabbit hole; surface it as the "dessert" when the due queue hits zero, with three guilt-free exits: *Sparked*, *Still curious*, or *Let it go (Compost)*.
- **Alan Kay:** could someone shape their own cards and rules?
  - Because `Assessment` (`{ effort, understanding }`) is stored raw in the log and `ratingOf` is a pure function mapping 2D space to FSRS ratings, the geometry of the Grid itself can be reshaped and replayed over a user's entire history.

## Unconfirmed

Some dates and editions in the rabbit hole are unchecked, such as when Rams' principles were published and the title of Norman's first edition. The ideas themselves are well known.

