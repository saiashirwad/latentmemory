# Environment and secrets

Tools come from mise (`mise.toml`). Secrets come from 1Password through fnox (`fnox.toml`). No secret value lives in the repo.

## Where things live

One 1Password Secure Note per stage, one concealed field per secret:

| Stage | Vault / item | Read by |
| --- | --- | --- |
| dev | `latentmemory-dev` / `flashcards` | read-only service account; token loaded from Keychain by mise |
| prod | `Dev` / `flashcards-prod` | your own 1Password login; agents cannot read it |

The dev item is meant to hold `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_TRANSACTION_KEY`, `TYPESAFE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`; the two Cloudflare fields are still `TODO`. The prod item holds `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_TRANSACTION_KEY`.

`flashcards` is the dev stage. `flashcards-prod` overrides it under `fnox -P prod`; the prod GitHub OAuth app has its own callback URL and the prod transaction key is separate.

`mise.toml` loads `OP_SERVICE_ACCOUNT_TOKEN` from the macOS Keychain (`security find-generic-password -s op-sa-latentmemory -w`). That service account is read-only on `latentmemory-dev` and has no access to `Dev`, so agents can resolve dev secrets without Touch ID and cannot reach prod.

## Local dev

`mise install` once. With `fnox activate` in your shell, entering the repo loads the secrets. Otherwise wrap the command.

```sh
fnox exec -- pnpm dev
```

Alchemy authenticates to Cloudflare through its own profile. Run `alchemy login` once. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are for CI, or for local runs without a login profile. Both are still `TODO` ([#13](https://github.com/saiashirwad/latentmemory/issues/13)); until they exist, local work uses the Alchemy login profile.

## Deploy

**Not ready yet.** Two open issues block a safe production path:

- [#13](https://github.com/saiashirwad/latentmemory/issues/13): do not share one Cloudflare token across stages. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are still `TODO`. Cloudflare's Workers, D1 and KV permissions are account-scoped, so a "dev" token in the production account is not a dev boundary. The recommendation is a separate dev Cloudflare account with a least-privilege token, prod credentials in a vault the agent service account cannot read, and explicit overrides for both variables under `[profiles.prod.secrets]`. `TYPESAFE_API_KEY` inheritance needs a separate decision. `fnox.toml` currently overrides only the three GitHub/OAuth secrets under `[profiles.prod.secrets]`; both Cloudflare variables still point at the dev provider.
- [#12](https://github.com/saiashirwad/latentmemory/issues/12): with `OP_SERVICE_ACCOUNT_TOKEN` in the environment, `fnox -P prod` resolves secrets with the service account before your login. Workaround:

```sh
env -u OP_SERVICE_ACCOUNT_TOKEN fnox -P prod exec -- pnpm deploy
```

The fix is a human-only mise task that removes the service-account token (and any 1Password Connect variables) **before fnox starts**, uses `--no-daemon` and strict missing-secret errors, and pins fnox rather than `latest`. Do not treat `fnox -P prod exec -- true` as a credential-free test: fnox resolves secrets before starting the child.

After those are closed:

```sh
fnox exec -P prod -- pnpm deploy
```

Worker secrets are not set by hand. The stack reads each from the environment with `Config.Redacted("NAME")` and passes it to the Worker `env`. Alchemy 2.0.0-beta.83 has no state-encryption password.

## Add a secret

1. Add a concealed field to `latentmemory-dev/flashcards` (and `Dev/flashcards-prod` if it differs by stage).
2. Add a line under `[secrets]` in `fnox.toml`. Add it under `[profiles.prod.secrets]` if prod differs.
3. Read it in the stack with `Config.Redacted`. Pass it to the Worker `env`.

## TODO

- GitHub OAuth app, dev. Callback `http://localhost:<port>/auth/github/callback`. Fill `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `latentmemory-dev/flashcards`.
- GitHub OAuth app, prod. Callback `https://<worker-origin>/auth/github/callback`. Fill the same fields in `Dev/flashcards-prod`.
- Cloudflare, dev. Provision a separate dev account, then fill `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `latentmemory-dev/flashcards`; the token needs Workers, D1, R2 and KV edit on that account only.
- Cloudflare, prod. Put the prod account ID/token in `Dev/flashcards-prod` and add both overrides under `[profiles.prod.secrets]`.
- Placeholders read `TODO` until filled.
