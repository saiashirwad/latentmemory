# Grader

Researched 2026-10-17. Grade a spoken explanation against a card. The grader runs asynchronously, and the resulting `Suggestion` is shown only after the user's `Assessment`, as calibration feedback; it is never pre-placed on the Grid. Two local artifacts live outside the repo:

- First spike: `/private/tmp/claude-501/-Users-texoport-code-flashcards/2ffcc363-ca52-4ec4-a9c8-0228fa2838cf/scratchpad/grader-spike/` (`grader.ts`, `fixtures.ts`, `run.ts`, `analyze.py`, `results.json`).
- Model-comparator pilot: `/private/var/folders/_f/yb2trsh50c1gv2dpybhtbw7r0000gn/T/opencode/grader-eval-20261017/report.md` (raw responses, blind labels, analysis).

Labels below: **measured** means I ran it. **Inferred** means reasoned, not run.

## Verdict

- Jev through `DecisionModel` works for this. The first spike matched 45 of 52 grades exactly, all 52 within one level (measured, 26 cases x 2, `jev-latest`). A follow-up pilot pinned `jev-1.13.0` and matched 84/104 and 88/104 exactly against two blind same-model comparators, with all 104 within one level (measured, 26 cases x 4).
- `rate` returns a continuous rating already. It is the probability-weighted position on the scale. No extra math needed for the pointer.
- Median latency is 282-304 ms per grade. About $0.00003764 per grade at the vendor's list price (measured usage, vendor price).
- The LLM half (extracting key concepts at card creation) was not measured. Only `TYPESAFE_API_KEY` was set. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` were unset.
- **Not validated against human judgments or real speech.** The follow-up's comparators are the same model family. Keep the output advisory, keep the pointer editable, and keep the user's Assessment authoritative.

## Shape

One `Decision.make` per grade call. One provider call answers every decision. Concept probabilities are generated per card, so the definition is built from `keyConcepts`.

```ts
export const GraderInput = Schema.Struct({
  front: Schema.String,
  back: Schema.String,
  keyConcepts: Schema.Array(Schema.String),
  transcript: Schema.String
})

const understanding = Decision.rate({
  instructions: "The transcript is a speech-to-text recording of a learner explaining the answer to a flashcard from memory. Rate how well the learner understands the card's answer. Judge ideas, not wording. Ignore filler words, hesitations and transcription errors. Do not reward length. Do not penalize brevity if the key ideas are present.",
  criteria: [
    { label: "none", description: "Nothing relevant, empty, off-topic, or the opposite of the answer." },
    { label: "fragments", description: "Touches the topic with vague or isolated fragments, or mixes a little truth with major errors." },
    { label: "partial", description: "Gets some key concepts right and misses others, without major errors." },
    { label: "mostly", description: "Gets nearly all key concepts right. Minor gaps or imprecision only." },
    { label: "complete", description: "Covers every key concept accurately." }
  ]
})

const misconception = Decision.probability({
  instructions: "The learner states something that contradicts the card's answer or is factually wrong about the topic. Omissions and vagueness do not count.",
  criteria: { false: "Nothing the learner says contradicts the answer.", true: "The learner asserts at least one claim that contradicts the answer." }
})

const offTopic = Decision.probability({ /* same pattern: transcript does not attempt the question */ })

export const gradeDefinition = (keyConcepts: ReadonlyArray<string>) =>
  Decision.make({
    input: GraderInput,
    decisions: {
      understanding, misconception, offTopic,
      ...Object.fromEntries(keyConcepts.map((concept, index) => [
        `concept${index}`,
        Decision.probability({
          instructions: `The learner conveys this idea, in any wording: ${concept}`,
          criteria: { false: "The idea is absent, contradicted, or too vague to count.", true: "The idea is clearly present." }
        })
      ]))
    }
  })
```

Run it with `DecisionModel.decide(gradeDefinition(input.keyConcepts), { input })`. It typechecks under `tsc --strict` with `exactOptionalPropertyTypes`. Dynamic concept keys erase the answer types, so the spike casts the answers to `Record<string, any>`. A real version should parse them at that one boundary.

The Decision API, verbatim from `effect@4.0.5/dist/ai/Decision.d.ts`:

```ts
export interface Rate<Level extends string> {
    readonly _tag: "Rate";
    readonly instructions: Description;
    readonly criteria: ReadonlyArray<{ readonly label: Level; readonly description: Description; }>;
}
export interface RateAnswer<Level extends string> {
    readonly rating: number;
    readonly label: Level;
    readonly probabilities: { readonly [L in Level]: number; };
    readonly confidence?: number | undefined;
}
export interface ProbabilityAnswer { readonly probability: number; }
```

The doc comment on `RateAnswer`: "`rating` is the probability-weighted position on the scale and may fall between two levels, within `[0, criteria.length - 1]`. `label` is the label of the level with the highest probability."

### Key concept extraction (LLM)

Jev is not an LLM, so it cannot write the concepts. One `generateObject` call at card creation does.

```ts
export const KeyConcepts = Schema.Struct({ concepts: Schema.Array(Schema.String) })

export const extractKeyConcepts = (card: { front: string; back: string }) =>
  LanguageModel.generateObject({
    objectName: "KeyConcepts",
    schema: KeyConcepts,
    prompt: [
      "List the key concepts a learner must convey to show they understand this flashcard's answer.",
      "Each concept is one short, self-contained, checkable claim. Use 2 to 5. Do not restate the question.",
      `Front: ${card.front}`, `Back: ${card.back}`
    ].join("\n")
  }).pipe(Effect.map((response) => response.value.concepts))
```

- Typechecks against `LanguageModel.generateObject` in `effect@4.0.5`. Never executed, no key (measured: typecheck only).
- It needs a `LanguageModel` layer: `AnthropicLanguageModel.model(...)` plus `AnthropicClient.layer`, or the OpenAI equivalents, plus `FetchHttpClient.layer`.
- Run it once per card, store the list on the card, let the user edit it. Hand-written concepts in my fixtures are the best case. Real extraction quality is unknown.

## Provider findings

- `@effect/ai-typesafe` sends `Rate` as a `score` question and `Probability` as a `noul` question, one request for all decisions. Measured response: every decision came back in one HTTP call.
- The adapter forwards only each level's `description`, not its `label`. Levels are positional. Reordering `criteria` changes meaning. The adapter maps probabilities back to labels by index (read in `TypeSafeDecisionModel.js`).
- Probabilities arrive rounded to two decimals. `DecisionModel` rescales the drift (`probabilityPrecision: 2`).
- `rate` exposes a full distribution over levels, a continuous `rating`, and a `confidence`. Example from the run, `hash-rambling-missing`: `{ none: 0, fragments: 0, partial: 0.71, mostly: 0.27, complete: 0.02 }`, rating 2.3, confidence 0.74.
- The returned `rating` matched the expected value over the level probabilities within 0.02 on all 52 grades (measured). So the provider is already giving the expected value. Computing it yourself is redundant.
- `Probability` answers carry no confidence field.
- Auth is `Authorization: Bearer`, base URL `https://api.typesafe.ai/v1`, models `jev-latest | jev-preview | jev-1.13.0`. The first spike used `jev-latest`; the follow-up pilot pinned `jev-1.13.0`.

## Fixtures

26 cases, 5 to 7 decisions each (understanding, misconception, offTopic, plus 2 to 4 concepts), written by me. Categories: complete 3, partial 6 (incl. vague and mostly), wrong-with-confidence 6 (incl. reversed and misconception), rambling-but-correct 3, short-but-correct 2, transcription noise 3, off-topic 3. Cards cover Promise.all, Rust borrow checker, binary search, JS closures, SQL joins, mitochondria, React useEffect cleanup, TypeScript unknown vs any, Python GIL, git rebase vs merge, hash tables, Spanish ser/estar, TCP vs UDP.

Expected levels run 0 to 4 against `none, fragments, partial, mostly, complete`. Rule of thumb I used: all concepts is 4, most is 3, about half is 2, hints is 1, nothing or opposite is 0.

## Results: first spike (measured)

| Metric | Value |
|---|---|
| Grades | 52 (26 cases x 2 runs), 0 errors |
| Exact label match | 45 / 52 |
| Within one level | 52 / 52 |
| Mean abs error, rating vs label | 0.25 levels |
| Pearson, rating vs label | 0.98 |
| Run-to-run, mean abs rating difference | 0.025 (max 0.08) |
| Run-to-run label flips | 1 / 26 |
| Latency p50 / p90 / max | 304 / 362 / 412 ms |
| Input tokens per grade | ~896 (807 to 1012) |
| Output tokens per grade | 107 |
| Cost per grade | ~$0.000038 at $0.042/M input, no output charge |

Per-case highlights (rating is 0 to 4, run 1):

| Case | Label | Rating | Note |
|---|---|---|---|
| promise-complete | 4 | 3.96 | |
| bsearch-short (`"Log n. You halve it each time, and it has to be sorted."`) | 4 | 3.81 | Brevity not punished |
| borrow-rambling, hash-rambling | 4 | 3.94, 3.99 | Length not rewarded either way |
| closure-noise, joins-noise | 4 | 3.52, 3.67 | Fillers and "no" for "null" tolerated, a little lower |
| tcp-noise | 3 | 3.30 | |
| promise-wrong, bsearch-wrong, mito-wrong, ser-estar-reversed | 0 | 0.05 to 0.19 | Misconception probability 0.93 to 0.97 |
| lunch, empty-dontknow | 0 | 0.14, 0.11 | `offTopic` 0.98 |
| unknown-wrong | 0 | 0.93 | Graded `fragments`. Partial miss |
| rebase-misconception | 1 | 0.90 | Misconception 0.96 |
| effect-half (`"only runs on unmount"`) | 2 | 1.43 | Graded `fragments`, misconception 0.94 |
| gil-mostly | 3 | 2.09 | Graded `partial` |
| hash-rambling-missing | 3 | 2.30 | Graded `partial` |

The four non-matching cases on run 1 are `effect-half`, `unknown-wrong`, `gil-mostly`, `hash-rambling-missing`. The last two are arguably my labels being generous, since each misses one of three concepts and the grader's coverage numbers said so (`gil-mostly` third concept 0.19). `effect-half` is a fair call. Saying it only runs on unmount is a wrong claim, not only an omission.

### What the measurement does not show

- The labels and fixtures are mine, written by the same session that wrote the rubric. Agreement is likely optimistic (inferred). The cases are clean and short. Real speech is messier.
- 26 cases is too small for confidence intervals. Treat 45/52 as a smoke result, not an accuracy.
- Key concepts were hand-written, not extracted. The real pipeline has one more error source.
- Latency was sequential calls from one machine, so it includes my network path. Cost uses the vendor's list price. I did not read an invoice.
- Run-to-run variance is tiny, but Jev may be deterministic apart from rounding, so two runs say little about drift across days or model versions. `jev-latest` may change under you. The follow-up pilot pinned `jev-1.13.0`; recheck the version and rate limits before depending on it.
- The tests all use the same decision wording. Nothing here tests prompt sensitivity.

## Results: follow-up pilot (measured)

Run 2026-10-17, after the first spike: `jev-1.13.0`, 26 cases x 4 sequential repeats (104 grades), 5 to 7 decisions per grade. Two independently spawned same-model comparator passes graded the same 26 transcripts with anonymized case IDs, supplied cards/concepts, and no access to expected labels, Jev outputs or each other's labels. The comparators agreed with each other on 25/26 labels; the remaining case differed by one level.

| Metric | Comparator A | Comparator B |
|---|---:|---:|
| Exact label | 84/104 (80.8%) | 88/104 (84.6%) |
| Within one level | 104/104 | 104/104 |
| Rating MAE, 0-4 | 0.289 | 0.258 |
| Label flips across 4 calls | 0 | 0 |

Disagreements were systematic rubric boundaries, not random noise. Both comparators called the one-fact borrow-checker answer, the vague mitochondria answer and the `Constant.` hash-table answer `fragments`, while Jev called them `partial`; both called the incorrect rebase answer `none`, while Jev called it `fragments`. The comparator passes themselves split on whether `"It rejects if one of them fails."` is `fragments` or `partial`.

These are related model judgments, not human truth. The fixtures were synthetic, the concepts hand-written, and the cases had been used during grader development. Textual filler and noise do not test real speech or STT. This does not close the human-first validation in [#6](https://github.com/saiashirwad/latentmemory/issues/6).

### Cost at scale (measured baseline, [#9](https://github.com/saiashirwad/latentmemory/issues/9))

- 104 grades used 93,208 input tokens, 896.23 per grade (range 807-1,012), and 10,924 output tokens.
- At $0.042 per million input tokens and free output, that is **~$0.00003764 per grade**, or ~$37.64 per million grades.
- One regrade of a year's reviews: 20/day $0.275; 50/day $0.687; 100/day $1.374.
- Multiply by the number of regrade passes. Added dimensions grow question tokens, so this is a baseline, not a quote for the expanded grader. It excludes extraction, STT, storage, discounts and tax.

## Per-concept coverage is unreliable when the transcript is off-topic (measured)

On `lunch`, the three concept probabilities were 0.49, 0.40, 0.41. On `empty-dontknow` they were 0.39, 0.30, 0.37. On `promise-offtopic-adjacent` they were 0.71, 0.58, 0.43. The absent concepts were not near zero. Mean coverage correlated with my labels at 0.85 against 0.98 for `rate`.

So: only show covered and missing concepts when `offTopic` is low, and threshold coverage around 0.5 on-topic. On-topic partial cases separated well (`promise-partial` 0.81, 0.24, 0.09).

## Mapping outputs to feedback

The pointer is feedback, not a prompt: the user's `Assessment` is recorded first, then the derived `Suggestion` is shown on the Grid. See `humane-design.md` and ADR-0002.

Understanding axis, 0 to 1:

```
position = understanding.rating / (levels.length - 1)
```

- `rating` is already the expected value over the five level probabilities. Real precision is about two digits, because the provider rounds probabilities to 0.01.
- Do not blend in the misconception probability. I tried `rating * (1 - misconception)`. Correlation with my labels dropped from 0.98 to 0.96, and it double-counts, since `rate` already marks wrong answers low (measured).
- Use `misconception` as a flag instead. Show the flag when it is above about 0.5 and offer the grader's wording. `effect-half` shows the risk. It flagged a legitimately wrong half-answer, which seems right to show.
- Use `confidence` for pointer styling, not placement. It correlated -0.41 with absolute error on my 52 grades, so low confidence does predict a miss, weakly (measured). A low-confidence pointer could render hollow or wider.
- The `offTopic` probability above about 0.5 snaps the pointer to the floor and suppresses the concept list.

Recall-effort axis: the grader does not touch it. Nothing in a transcript measures how hard recall felt. Hesitation markers, words per second and clip length might hint at it, but I did not test them (guess). Leave it to the user's drag, defaulting to a neutral position.

Mapping to FSRS (from `voice-recall.md`): grade is computed in code from the final pointer, not from the model. A starting rule: position below 0.25 is Again, below 0.6 Hard, otherwise Good, with Easy needing the effort axis or a deliberate user gesture. The thresholds are a guess. The placeholder `ratingOf` in `packages/domain/src/assessment.ts` uses different cuts (Again below 0.4 Understanding; Easy at Understanding >= 0.8 and Effort <= 0.3; Hard at Understanding < 0.7 or Effort > 0.85). Those are also guesses: [#7](https://github.com/saiashirwad/latentmemory/issues/7) was closed without review data. Store the raw `{ effort, understanding }`, the model's `rating`, `probabilities`, and the user's final point per review, so any mapping can be refit.

## How to run

```sh
cd <spike dir>
npm i
npx tsc -p .                                  # typecheck
TYPESAFE_API_KEY=... RUNS=2 OUT=results.json JEV_MODEL=jev-1.13.0 npx tsx run.ts
python3 analyze.py results.json
```

Optional env: `JEV_MODEL` (default `jev-latest`; pin `jev-1.13.0`). The Anthropic or OpenAI extraction path needs a `LanguageModel` layer composed in a separate script. I did not write one, since no key was available.

## Human validation (planned, [#6](https://github.com/saiashirwad/latentmemory/issues/6))

The synthetic pilots do not establish grading accuracy. The next measurement is human-first:

- Freeze rubric boundaries and metrics first: confusion matrix, exact and within-one agreement, signed error, ordinal-weighted agreement. Prespecify severe events (two-level gaps; `mostly`/`complete` despite an essential contradiction; unsupported misconception accusations; STT or extraction changes that alter the audit conclusion) and review every one. Don't tune them away on the same test set.
- The user commits Understanding and Effort before seeing any grader output or extracted checklist. Keep "what I'd have picked" separate from evidence-based fidelity of the spoken answer.
- For fidelity, use an audio-faithful transcript and a second competent human, both blind to Jev. Preserve independent labels before adjudication. If only the user can rate, a delayed blind re-rating is intra-rater, not human-human validation.
- Validate extracted concepts against a checklist written before seeing extraction. Count missing essentials, unsupported claims, and optional details promoted to requirements; preserve raw and edited lists.
- Separate STT from grading. Mark meaning-changing negation, number and technical-term errors, not just word error rate.
- 50 distinct recordings is a failure-discovery pilot, not a safety certificate. Illustratively, 40/50 exact gives a Wilson 95% interval of roughly 67-89%; even 0/50 severe events leaves a one-sided 95% upper rate of 5.8%. Repeated cards and convenience sampling weaken that. Keep feedback advisory and the user's assessments authoritative.

## Open questions

- Extraction quality: run `extractKeyConcepts` on real cards and read the lists. Bad concepts feed straight into the coverage list.
- Real speech: still open. Grade ~50 of your own recorded answers after STT, as `voice-recall.md` already planned. These fixtures and the synthetic pilot are a floor, not validation.
- Boundary cases: settle whether the borrow-checker, mitochondria, `Constant.` and rebase answers are `fragments`, `partial` or `none` before tuning pointer thresholds.
- Whether `gil-mostly`-style cases should land at `partial` or `mostly` is a taste call. Decide with your own sense of what "understood" means.
- Jev is in early access. `jev-1.13.0` is pinned for the pilot; check rate limits and drift before depending on it.

## Sources

- `effect@4.0.5` `dist/ai/Decision.d.ts` and `dist/ai/DecisionModel.d.ts` (installed package)
- `@effect/ai-typesafe@4.0.5` `dist/TypeSafeDecisionModel.js`, `TypeSafeClient.js`, `TypeSafeSchema.d.ts` (installed package)
- `effect@4.0.5` `dist/ai/LanguageModel.d.ts`, `@effect/ai-anthropic@4.0.5` `dist/AnthropicLanguageModel.d.ts`
- https://docs.typesafe.ai/concepts/system-one (price and latency claims, via `voice-recall.md`)
- `research/voice-recall.md`
