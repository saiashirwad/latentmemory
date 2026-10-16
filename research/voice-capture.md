# Voice capture

Spiked 2026-10-17. Speak → transcribe works. Chromium records, Workers AI `nova-3` and `whisper-large-v3-turbo` both take mp4/AAC, webm/opus and wav raw. Not tested on a real iPhone.

Labels: **measured** ran here. **sourced** from a doc or bug tracker. **inferred** or **unverified** is a guess.

## Setup

- Worker with an `ai` binding under `wrangler dev` (wrangler logged in, remote AI calls). Nothing deployed.
- Clips: macOS `say` (Samantha), then ffmpeg 9.0.2 to wav 16 kHz mono, mp4 (AAC 64k, fragmented), webm (opus 32k).
- A: 5.3 s, "A monad is a type with flatMap and pure that obeys the associativity and identity laws."
- B: 10.5 s, "In Effect, a Schema decodes unknown input at the boundary, and idempotent operations are safe to retry. FSRS schedules the next review using stability and difficulty."
- TTS is clean studio speech. Real phone audio will score worse (inferred).

## Browser capture

Measured in Playwright Chromium headless with fake device (`--use-file-for-fake-audio-capture`).

| mimeType | isTypeSupported |
|---|---|
| `audio/webm`, `audio/webm;codecs=opus` | true |
| `audio/mp4`, `audio/mp4;codecs=mp4a.40.2` | true |
| `audio/ogg;codecs=opus`, `audio/wav`, `audio/mpeg`, `audio/aac` | false |

- Default `mediaRecorder.mimeType` was `audio/webm;codecs=opus`.
- Full loop passed: getUserMedia, MediaRecorder 4 s, blob POSTed to the Worker, `nova-3` returned a transcript in 346 ms. The fake device file was cut at 4 s, so the transcript stops mid-sentence.
- Chromium mp4 recording was only probed with `isTypeSupported`, not recorded.

iOS Safari:

- `audio/mp4` with AAC is the long-standing output (sourced, [testmuai](https://www.testmuai.com/learning-hub/mediarecorder-browser-support/), secondary). The same page says webm/opus arrives in iOS 18.4+ (unverified).
- Feature-detect in order: `audio/webm;codecs=opus`, then `audio/mp4`. Send the blob's own `type` as `Content-Type`.
- Start capture from a tap. getUserMedia needs a secure context (sourced, same page).

Installed iOS PWA, permissions and recording:

- Microphone permission is reported to re-prompt in standalone mode. [WebKit 215884](https://bugs.webkit.org/show_bug.cgi?id=215884) describes the grant not persisting, revoked on hash or path change, short grant windows when capture is idle. It is marked "configuration changed". A 2026 third-party PR says iOS asks on each launch and ignores the Safari grant (secondary).
- Apple forum report: a home-screen app records on first launch, then fails after close and reopen until the phone restarts. [thread 797987](https://developer.apple.com/forums/thread/797987). One user report, undated here.
- [WebKit 185448](https://bugs.webkit.org/show_bug.cgi?id=185448) (2018, fixed) made getUserMedia work in home-screen apps at all.
- Verdict: recording in an installed PWA should work, with a likely permission prompt per launch. **Unverified.** Test on the actual phone and iOS version before committing to the PWA shell. Keep a plain-Safari fallback.
- Keep the route fixed while recording. Don't navigate with path or hash changes mid-session (inferred from 215884).

## Transcription

Request: raw audio body to the Worker, model chosen by query param. Measured against real Workers AI via `wrangler dev`.

### Input shape

| Model | `audio` | Vocab hint |
|---|---|---|
| `@cf/deepgram/nova-3` | `{ body: ReadableStream, contentType: string }` | `keyterm: string` |
| `@cf/openai/whisper-large-v3-turbo` | base64 string | `initial_prompt: string` |

- Nova-3 `audio` shape comes from the model page schema (sourced). The page doesn't say how containers are handled.
- Chunk the base64 encode on Workers. `String.fromCharCode(...bytes)` on a 168 KB wav threw `Maximum call stack size exceeded`.

### Containers

| Clip | nova-3 | whisper-turbo |
|---|---|---|
| wav | ok | ok |
| mp4 / AAC | ok | ok |
| webm / opus | ok | ok |

- Nova-3 also worked with `Content-Type` set to `audio/webm` on an mp4 body, and to `application/octet-stream`. It sniffs the container. Don't rely on the header (measured, inferred reason).
- I didn't set `encoding`. The docs list it for raw codecs only.

### Latency (wall time inside the Worker, one run unless noted)

| Clip | nova-3 | whisper-turbo |
|---|---|---|
| A, 5.3 s | 257 to 575 ms | 1.8 to 2.2 s |
| B, 10.5 s | 343 to 635 ms (6 runs) | 1.0 to 8.2 s (5 runs) |

- Nova-3 is steady at 0.3 to 0.6 s. Whisper is slower and spiky. One 8.2 s outlier on B/mp4 (cold start or queueing, guess).
- Small sample, no warm-up control, not a benchmark.

### Quality on technical terms

| Term | nova-3 | nova-3 + `keyterm=flatMap` | whisper-turbo |
|---|---|---|---|
| flatMap | "flat map" | "flatmap" | "flat map", or "flatMap" with `initial_prompt` |
| monad, associativity, idempotent, Schema, Effect | correct | correct | correct |
| FSRS | "fsrs" | "fsrs" | "FSRS" |
| unknown (clip B) | "a known" | "a known" | "a known" |

- Nova-3 output is lowercase, unpunctuated. Whisper is cased and punctuated.
- `keyterm` works. One term, comma-joined terms and space-joined terms all produced "flatmap". `keyterm=Effect` alone did not change "flat map". Per-term effect of a long list is untested.
- Whisper dropped a space after a period once under `initial_prompt` ("retry.FSRS").
- "unknown input" to "a known input" is a TTS ambiguity on every model and container. Treat it as a reminder that the grader should tolerate transcript noise.
- Words carry per-word `confidence` in nova-3. Low-confidence words ("flat" 0.63 to 0.79, "map" 0.62 to 0.75) tracked the miss. Usable as a grader signal (inferred).
- Container didn't change the transcript. All three containers gave identical text on both clips, per model.

### Cost

Same as `voice-recall.md`. The whole spike was about 50 calls on short clips, well under a cent.

## Decision

- Use `nova-3`. Faster, steadier, takes every container, `keyterm` works. Send the card's terms.
- Keep whisper as the cased, punctuated fallback.
- Groq and OpenAI were not tested. No keys in env, and Workers AI worked.

## Worker endpoint shape

Untested sketch, written against the style in `mcp-oauth.md`. Check the effect 4.0.5 `HttpServerRequest` and `HttpServerResponse` names before copying.

```ts
class WorkersAi extends Context.Service<WorkersAi, Ai>()("app/WorkersAi") {}

const Transcript = Schema.Struct({ text: Schema.String })

const transcribe = HttpRouter.add("POST", "/transcribe",
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const ai = yield* WorkersAi
    const keyterm = yield* Schema.decodeUnknown(Schema.optional(Schema.String))(
      new URL(req.url, "http://x").searchParams.get("keyterm") ?? undefined)
    const audio = yield* req.arrayBuffer
    const out = yield* Effect.tryPromise(() =>
      ai.run("@cf/deepgram/nova-3", {
        audio: { body: new Blob([audio]).stream(), contentType: req.headers["content-type"] ?? "audio/mp4" },
        ...(keyterm && { keyterm }),
      }))
    const text = out.results.channels[0].alternatives[0].transcript
    return yield* HttpServerResponse.schemaJson(Transcript)({ text })
  }))
```

- Raw body, not multipart. One blob, no form parsing. Content type comes from the blob.
- Guard at the boundary: auth (yielded session), a body size cap, and a Schema decode of `out` (the binding's output type isn't typed for this model).
- Provide `WorkersAi` from `env.AI` the same way `OAuthApi` comes from `env.OAUTH_PROVIDER`.

## Open

- Real iPhone, installed PWA: record 10 s, check mimeType, permission prompt on relaunch, relaunch failure from the Apple thread.
- Real mic audio with noise and mumbling, not TTS.
- Max body size and max clip length Workers AI accepts. Not probed.
- Whether `keyterm` takes an array. The docs say string.

## Sources

- https://developers.cloudflare.com/workers-ai/models/nova-3/
- https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/
- https://www.testmuai.com/learning-hub/mediarecorder-browser-support/
- https://bugs.webkit.org/show_bug.cgi?id=215884
- https://bugs.webkit.org/show_bug.cgi?id=185448
- https://developer.apple.com/forums/thread/797987
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
