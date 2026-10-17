# Latent Memory

A cognitive prosthesis for the AI era — spaced-repetition practice for things noticed while learning with AI agents, built as an antidote to *epistemic illusion* (the feeling that because an agent explained something clearly in the moment, you now own that knowledge).

## Language

**Card**:
A single thing to practice, with a front that prompts and a back that answers.
_Avoid_: Note, flashcard, prompt, item

**Tag**:
A lowercase, hyphenated label on a Card. The only way Cards are grouped.
_Avoid_: Deck, folder, collection, category

**Source**:
Where a Card came from: a Conversation with an agent, a web page, or written by hand.
_Avoid_: Origin, provenance, context

**Motive**:
Why a Card was worth making, in the maker's own words.
_Avoid_: Reason, purpose, note

**Excerpt**:
The passage from the Source that made the Card worth creating.
_Avoid_: Snippet, quote, context

**Duplicate**:
A Card whose front matches an existing Card's front once case and whitespace are ignored.
_Avoid_: Copy, near-duplicate (a similar Card is not a Duplicate)

**Review**:
One attempt at recalling a Card. Reviews are never changed or removed once recorded.
_Avoid_: Answer, attempt, rep

**Grid**:
The two-dimensional field a Review ends on, with Effort along one side and Understanding along the other, coloured by the Rating each region gives.
_Avoid_: Chart, slider, buttons

**Assessment**:
The point left on the Grid when a Review ends, made of Effort and Understanding.
_Avoid_: Grade, score, answer

**Effort**:
Subjective phenomenology: how hard recalling the Card felt (*how hard did my brain work?*).
_Avoid_: Difficulty (FSRS uses that for something else), hardness

**Understanding**:
Objective fidelity: how well the Card's answer is actually grasped (*did I actually grasp the idea?*), as opposed to how sure one feels.
_Avoid_: Confidence, correctness

**Transcript**:
What was said during a Review, as text. It arrives after the Review is recorded, and the recording is not kept once it does.
_Avoid_: Answer, response, recording

**Hesitation**:
How long a Review took to get going: from the front appearing to starting to speak, or to Reveal when nothing is said.
_Avoid_: Latency, delay, response time

**Grading**:
What a grader concluded from a Transcript, kept with the name of the grader that made it. It is made after its Review is over and can be thrown away and made again.
_Avoid_: Grade, score, evaluation

**Suggestion**:
Where the Assessment is expected to be, worked out from the Grading and the Hesitation. It is only ever shown after the Assessment, as feedback on that Review, never as a starting point on the Grid.
_Avoid_: Auto-grade, prediction

**Disagreement**:
A Review whose Suggestion lands far from its Assessment, such as a missed Key Concept when Understanding was marked high.
_Avoid_: Mismatch, error, wrong answer

**Key Concept**:
An idea a good answer to a Card has to include. A Card has at most three.
_Avoid_: Keyword, rubric item, keyterm

**Rating**:
FSRS's Again, Hard, Good or Easy, always worked out from an Assessment and never chosen directly.
_Avoid_: Grade, ease

**Skip**:
Moving past a due Card without a Review. It says nothing about memory.
_Avoid_: Bury, defer, pass

**Undo**:
Cancelling a Review that is still its Card's latest, recorded as its own entry rather than by removing the Review.
_Avoid_: Revert, delete review

**Reset**:
Starting a Card's memory over, so its Schedule is worked out only from Reviews after that point.
_Avoid_: Forget, relearn

**Active / Suspended / Deleted**:
A Card is Active when it can come due, Suspended when kept but never due, and Deleted when hidden with its Reviews kept.
_Avoid_: Archived, paused, removed

**Day**:
A person's day in their own timezone, rolling over at 4am rather than midnight.
_Avoid_: Date, calendar day

**Schedule**:
When a Card is next due and how well it is remembered, as worked out from its Reviews.
_Avoid_: Card state, SRS data
