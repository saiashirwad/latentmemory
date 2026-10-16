# Voice recall

Researched 2026-10-17. Speak an explanation instead of tapping a rating. Transcribe it, grade it against the card, map the grade to FSRS.

## Speech to text

| Option | Per min | Notes |
|---|---|---|
| CF Workers AI `@cf/deepgram/nova-3` | $0.0052 | AI binding, no key. `keyterm` for technical vocab. Container formats undocumented |
| CF Workers AI `@cf/openai/whisper-large-v3-turbo` | ~$0.0005 | AI binding. `initial_prompt` for vocab |
| Groq `whisper-large-v3-turbo` | ~$0.0007 | 10 s minimum billed. 25 MB. Accepts mp4, m4a, webm |
| OpenAI `gpt-4o-transcribe` | ~$0.006 (estimate) | 25 MB. Accepts mp4, m4a, webm. `prompt` param |
| Deepgram direct Nova-3 | $0.0043, keyterm +$0.0013 | Accepts MP4, AAC, WebM, Opus |
| AssemblyAI, ElevenLabs Scribe | ~$0.0035 | Keyterms up to 1,000 |
| Web Speech API | free | No |

- **Default:** `nova-3` on Workers AI with the card's terms as `keyterm`. A 90 s clip is under a cent.
- **Gate:** send a 10 s clip from iOS Safari (`audio/mp4`) and Chrome (`audio/webm`) through the binding before committing.
- **Fallback:** Groq Whisper, or OpenAI. Both document mp4 and webm.
- **Web Speech API is out.** Chrome sends audio to Google. It reportedly doesn't work in iOS home-screen apps (dated evidence). It gives no audio file to keep or regrade.

## Grading with Effect

Effect 4.0.5 ships `effect/ai` with a `DecisionModel` service and typed decisions. `@effect/ai-typesafe@4.0.5` is the Jev provider for it. Verified in the installed package.

- `Decision.rate({ instructions, criteria: [...] })`: ordered levels. Maps onto Again, Hard, Good, Easy.
- `Decision.probability({ instructions, criteria? })`: one yes/no likelihood. One per key concept.
- `Decision.classify({ instructions, criteria: { label: description } })`: unordered labels, e.g. misconception kinds.
- `Decision.make({ input: Schema, decisions })` builds a definition. `DecisionModel.decide` answers it in one provider call, Schema-validated, failures as `AiError`.

`LanguageModel.generateObject({ prompt, schema })` is there too for free-form structured output, with `@effect/ai-anthropic` and `@effect/ai-openai` at 4.0.5.

## Jev

TypeSafe AI's "System One" model. Typed questions in, typed answers with probabilities out. Not an LLM.

- Vendor claims 70–500 ms per call, $0.042 per million input tokens, no output charge.
- Early access since 2026-09-15. Most material is vendor-written.
- Pattern from the deepeval integration: an LLM extracts the card's key concepts once, Jev answers questions about each transcript.

## Mapping grades to FSRS

- FSRS uses only intervals and grades. Response time doesn't feed the scheduler.
- Again/Good alone is sometimes as accurate as all four. So: core concept missing or misconception → Again, partial → Hard, complete → Good. Easy needs a human tap (guess).
- Compute the rating in code from the decisions, so the mapping is testable.
- Pre-select the grade, one tap to override. Store the model grade and the final grade.
- A lenient grader inflates stability. Optimize weights only on confirmed grades until agreement is measured (inferred, untested).
- Judges favor longer answers, and changing models moved leniency by up to 56 points in one 2026 preprint (arxiv 2610.05094).

## Rubric

- Extract key concepts onto the card when it's created. Grading checks against a list, not a vibe.
- Temperature 0, reference answer in the prompt.
- Before building UI, grade ~50 of your own answers and measure agreement with your own ratings.

## Prior art

Thin. A buggy Anki add-on, AnkiCLI for typed answers, Active Recalling (marketing only). Dunlosky et al. 2013 rate self-explanation as moderate utility, practice testing as high. Speaking an explanation is a plausible retrieval-practice variant, not a proven upgrade.

## Sources

- https://developers.cloudflare.com/workers-ai/models/nova-3/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://console.groq.com/docs/speech-to-text
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.deepgram.com/docs/supported-audio-formats
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- https://docs.typesafe.ai/concepts/system-one
- https://deepeval.com/integrations/models/typesafe-ai
- https://docs.ankiweb.net/faqs/frequently-asked-questions-about-fsrs.md
- https://arxiv.org/pdf/2610.05094v1
