import * as Cloudflare from "alchemy/Cloudflare";
import * as SQL from "alchemy/SQL/D1";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { Db } from "./db.ts";

export default Cloudflare.Worker(
  "Api",
  { main: import.meta.url, dev: { port: 8790, strictPort: true } },
  Effect.gen(function* () {
    const d1 = yield* Cloudflare.D1.QueryDatabase(Db);
    const sql = yield* SQL.D1(d1);

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        if (request.method !== "GET" || request.url !== "/health") {
          return HttpServerResponse.empty({ status: 404 });
        }
        yield* sql`select 1`;
        return yield* HttpServerResponse.json({ ok: true });
      }).pipe(
        Effect.catchTag("SqlError", (error) =>
          Effect.succeed(HttpServerResponse.text(error.message, { status: 500 })),
        ),
      ),
    };
  }).pipe(Effect.provide(Cloudflare.D1.QueryDatabaseBinding)),
);
