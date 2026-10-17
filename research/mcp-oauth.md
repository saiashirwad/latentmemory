# MCP + OAuth on Workers

Spiked 2026-10-17, local `wrangler dev` only. The full flow passes end to end. The MCP transport revision claude.ai actually speaks is still open; see below.

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

- Stateless hosting does not require modern-only MCP. [2025-11-25 permits session IDs to be omitted](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management), while still requiring `initialize`.
- The constraint is Effect's adapters, not the protocol. Installed Effect 4.0.5 `layerHttpRequestScoped` (sessionless, Workers-friendly) only speaks `2026-07-28`; `layerHttp` speaks `2025-11-25` and `2025-06-18` but keeps the session in one isolate's memory (inferred to break across isolates). The official-SDK inspector also fails against `layerHttpRequestScoped` with `MCP-Protocol-Version header is required`.
- `2026-07-28` drops `Mcp-Session-Id` and `initialize`. Servers mint no session ids. Its [compatibility matrix](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions) says legacy clients cannot fall forward to modern-only servers. Modern requests need matching version metadata/header plus method/name headers; logging only the first version header is insufficient.
- Public claude.ai evidence is mixed. A [connector collaborator says the old header bug was fixed 2026-03-26](https://github.com/anthropics/claude-ai-mcp/issues/99#issuecomment-4431633875). A [June report](https://github.com/anthropics/claude-ai-mcp/issues/473) logs ClaudeAI requesting `2025-11-25`; its apparent handshake failure was [confirmed as >10-second initialize latency](https://github.com/anthropics/claude-ai-mcp/issues/473#issuecomment-4796224761), not a version mismatch. These are historical observations, not today's guarantee.
- Current [Claude auth docs](https://claude.com/docs/connectors/building/authentication) specify OAuth requirements but do not establish a transport revision.
- Cloudflare deprecated `McpAgent`. `createMcpHandler` (now in `@modelcontextprotocol/server@2`) is stateless and accepts 2025 Streamable HTTP clients.
- **Next test.** Point a fresh claude.ai connector at the exact modern-only layer, then compare a legacy/session-ID-optional endpoint if needed. Capture the RPC method, initialize requested/selected version or modern `_meta`, protocol/method headers, session presence/digest, status/error and latency. Never log tokens, cookies or full bodies. Require successful discovery plus an inert tool call; isolate transport authlessly first, then repeat with OAuth. Tracked in [#4](https://github.com/saiashirwad/latentmemory/issues/4).

## What claude.ai requires

From https://claude.com/docs/connectors/building/authentication.

- Registration: DCR, CIMD, or none. CIMD is used only when AS metadata has `client_id_metadata_document_supported: true` and `"none"` in `token_endpoint_auth_methods_supported`. Otherwise DCR.
- PKCE S256. RFC 8707 `resource` matching the MCP URL.
- `401` with `WWW-Authenticate: Bearer resource_metadata=…`. RFC 9728 `resource` must match exactly. Only the first `authorization_servers` entry is used.
- Callback `https://claude.ai/api/mcp/auth_callback`. Allowlist claude.com too.
- Token and registration answer within 10 s, refresh within 30 s. `/token` accepts form-urlencoded. Refresh tokens rotate.
- `2026-07-28` deprecates DCR in favour of CIMD.

## GitHub sign-in

From yielded's docs, unrun.

- GitHub OAuth App, callback `${origin}/auth/github/callback`.
- Secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_TRANSACTION_KEY` (32 random bytes, base64url).
- `GitHub.provider(...)` under `oauth.providers`, `OAuth.OAuthTransactionProtector.layer(keys)`, `OAuth.OAuthReturnTargets.exactRoutes(["/authorize/resume"])`, `OAuth.makeRegistration`, `WorkerdPasswordlessServices.layer`.
- Return targets can't carry a query string. Stash the `/authorize?...` request in a short-lived cookie and resume from `/authorize/resume`.
- GitHub-only skips the password stack (email delivery, reset, Argon2id CPU cost).

## Alternative

yielded beta.42 ships `OAuthServer`, an MCP authorization server (see `examples/auth/src/strava-mcp.ts`). Static clients and Client ID Metadata Documents, no DCR. claude.ai accepts CIMD, so this could replace workers-oauth-provider and KV if its persistence runs on D1. That part is unverified.

## Numbers

- Bundle 690 KiB gzipped.
- Local wall time: registration 66 ms, sign-in 49 ms, mostly Argon2id.
