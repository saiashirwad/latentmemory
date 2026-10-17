import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as State from "alchemy/State";
import * as Effect from "effect/Effect";

import { Db } from "./src/db.ts";
import Api from "./src/worker.ts";

export default Alchemy.Stack(
  "LatentMemory",
  { providers: Cloudflare.providers(), state: State.localState() },
  Effect.gen(function* () {
    const db = yield* Db;
    const api = yield* Api;
    const web = yield* Cloudflare.Website.Foldkit("Web", {
      rootDir: "../web",
      dev: { port: 5173, strictPort: true },
    });
    return { databaseName: db.databaseName, api: api.url, web: web.url };
  }),
);
