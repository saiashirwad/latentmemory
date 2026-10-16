# Effect versions: foldkit + yielded auth

Spiked 2026-10-17. Result: one browser app runs foldkit and `@yielded/auth`'s client on a single `effect@4.0.5`.

## Versions

- `foldkit` 0.168.0 (peer `effect: 4.0.0` exact)
- `@yielded/auth` 0.1.0-beta.42 (peer `effect: ^4.0.3`)
- `@effect/platform-browser@4.0.5` needs `effect ^4.0.5`
- `alchemy` 2.0.0-beta.83 (peer `effect: ^4.0.0`)

## Fix

Override both in `pnpm-workspace.yaml`:

```yaml
overrides:
  effect: 4.0.5
  "@effect/platform-browser": 4.0.5
```

`pnpm peers check` is clean and `node_modules/.pnpm` holds one `effect`. foldkit on 4.0.5 is only tested by the spike.

## foldkit + yielded

Use yielded's `Client` from foldkit Commands. Skip its Atom helpers: they need an Effect Atom registry, which would be a second state system next to the Model.

```ts
export const AuthApi = AuthContract.make('flashcards', {
  claims: Schema.Struct({}),
  actions: () => ({
    signInWithGitHub: AuthContract.oauthSignIn({ strategy: 'github' }),
  }),
})
export const AppClient = Client.make(AuthApi, { baseUrl, requestTimeout: '5 seconds' })
export type AppClientService = Layer.Success<typeof AppClient.layerFetch>

Runtime.makeApplication({ ..., resources: AppClient.layerFetch.pipe(Layer.orDie) })

const SignInWithGitHub = Command.define('SignInWithGitHub', {
  messages: [Message.SucceededSignIn, Message.FailedSignIn],
  execute: Effect.gen(function* () {
    const { auth } = yield* AppClient
    yield* auth.signInWithGitHub({ provider: 'github', returnTarget: '/' })
    return Message.SucceededSignIn()
  }).pipe(Effect.catch(e => Effect.succeed(Message.FailedSignIn({ reason: e._tag })))),
})
```

## Gotchas

- `Client.make` returns a service definition. `yield* AppClient` gives `{ auth }`.
- `oauthSignIn` succeeds with `authorizationUrl` as a `Redacted` string. Redirecting is a separate Command.
- Once `resources` is set, type `update` and `init` with the service: `Update.Return<Model, Message, AppClientService>`, `Runtime.ApplicationInit<Model, Message, void, AppClientService>`.
- `resources` takes an infallible Layer, hence `Layer.orDie`.
- The contract needs a `claims` schema. `getSession`, `signOut` and `renewSession` come for free.
- `vp` lives in `~/.vite-plus/bin`. `vp create` has no foldkit template. Scaffold with `npx create-foldkit-app -r spa`.
