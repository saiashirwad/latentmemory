# MCP + OAuth on Workers

Spiked 2026-10-17, local `wrangler dev` only. The full flow passes end to end.

## Shape

One Worker. `@cloudflare/workers-oauth-provider` wraps it and owns metadata, DCR, PKCE and tokens. Its `/authorize` is an Effect route that asks yielded for the session. MCP is Effect's own `McpServer`.

```ts
class OAuthApi extends Context.Service<OAuthApi, OAuthHelpers>()("app/OAuthApi") {}
const McpUser = Context.Reference<Props | undefined>("app/McpUser", { defaultValue: () => undefined })

const app = HttpRouter.toWebHandler(
  Layer.mergeAll(http.routes(), AppRoutes.pipe(http.middleware)).pipe(
    Layer.provide(AuthLive), Layer.provide(HttpServer.layerServices)))

export default new OAuthProvider<Cloudflare.Env>({
  apiRoute: "/mcp",
  apiHandler: { fetch: (req, _env, ctx) => mcp.handler(req, Context.make(McpUser, ctx.props as Props) as never) },
  defaultHandler: { fetch: (req, env) => app.handler(req, Context.make(OAuthApi, env.OAUTH_PROVIDER)) },
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: ["cards"],
  resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin] },
})
```

- `/authorize` with no session redirects to sign-in. With one, it shows consent, then `completeAuthorization({ userId: session.subjectId, props })`.
- The consent page is required. Without it, any self-registered client gets a token silently.
- Tool handlers `yield* McpUser`. Identity comes from the token on each request, not the MCP session.

## Storage

- yielded on D1 through `@yielded/auth-persistence-drizzle/D1`, managed tables. Needs `drizzle-orm@1.0.0-rc.4` plus `bunx @yielded/drizzle-effect-v4-patch@beta patch` (Bun only). yielded's plain Effect SQL persistence doesn't run on D1.
- workers-oauth-provider 1.2.3 needs a KV namespace (`OAUTH_KV`). No D1 option.

## Open: MCP protocol version

- `layerHttpRequestScoped` (sessionless, Workers-friendly) only speaks `2026-07-28`. The official-SDK inspector fails against it with `MCP-Protocol-Version header is required`.
- `layerHttp` speaks `2025-11-25` and `2025-06-18` but keeps the session in one isolate's memory. On real Workers that should break across isolates (inferred).
- Which version claude.ai speaks decides between the request-scoped endpoint and a Durable Object.

## GitHub sign-in

From yielded's docs, unrun.

- GitHub OAuth App, callback `${origin}/auth/github/callback`.
- Secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_TRANSACTION_KEY` (32 random bytes, base64url).
- `GitHub.provider(...)` under `oauth.providers`, `OAuth.OAuthTransactionProtector.layer(keys)`, `OAuth.OAuthReturnTargets.exactRoutes(["/authorize/resume"])`, `OAuth.makeRegistration`, `WorkerdPasswordlessServices.layer`.
- Return targets can't carry a query string. Stash the `/authorize?...` request in a short-lived cookie and resume from `/authorize/resume`.
- GitHub-only skips the password stack (email delivery, reset, Argon2id CPU cost).

## Alternative

yielded beta.42 ships `OAuthServer`, an MCP authorization server (see `examples/auth/src/strava-mcp.ts`). Static clients and Client ID Metadata Documents, no DCR. Could replace workers-oauth-provider and KV if claude.ai accepts CIMD and its persistence runs on D1. Neither is verified.

## Numbers

- Bundle 690 KiB gzipped.
- Local wall time: registration 66 ms, sign-in 49 ms, mostly Argon2id.
