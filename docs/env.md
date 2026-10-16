# Environment and secrets

Tools come from mise (`mise.toml`). Secrets come from 1Password through fnox (`fnox.toml`). No secret value lives in the repo.

## Where things live

1Password vault `Dev`, one Secure Note per stage, one concealed field per secret.

| Item | Fields |
| --- | --- |
| `flashcards` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_TRANSACTION_KEY`, `TYPESAFE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |
| `flashcards-prod` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_TRANSACTION_KEY` |

`flashcards` is the dev stage. `flashcards-prod` overrides it under `fnox -P prod`. The prod GitHub OAuth app has its own callback URL and the prod transaction key is separate.

## Local dev

`mise install` once. With `fnox activate` in your shell, entering the repo loads the secrets. Otherwise wrap the command.

```sh
fnox exec -- pnpm dev
```

Alchemy authenticates to Cloudflare through its own profile. Run `alchemy login` once. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are for CI, or for local runs without a login profile.

## Deploy

```sh
fnox exec -P prod -- pnpm deploy
```

Worker secrets are not set by hand. The stack reads each from the environment with `Config.Redacted("NAME")` and passes it to the Worker `env`. Alchemy 2.0.0-beta.83 has no state-encryption password.

## Add a secret

1. Add a concealed field to the `flashcards` item (and `flashcards-prod` if it differs by stage).
2. Add a line under `[secrets]` in `fnox.toml`. Add it under `[profiles.prod.secrets]` if prod differs.
3. Read it in the stack with `Config.Redacted`. Pass it to the Worker `env`.

## TODO

- GitHub OAuth app, dev. Callback `http://localhost:<port>/auth/github/callback`. Fill `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `flashcards`.
- GitHub OAuth app, prod. Callback `https://<worker-origin>/auth/github/callback`. Fill the same fields in `flashcards-prod`.
- Cloudflare. Fill `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in `flashcards`. Token needs Workers, D1, R2 and KV edit.
- Placeholders read `TODO` until filled.
