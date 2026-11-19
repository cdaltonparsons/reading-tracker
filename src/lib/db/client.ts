import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

// Wraps any libSQL client, so tests can inject their own database.
export function createDb(client: ReturnType<typeof createClient>) {
  return drizzle(client, { schema });
}

let db: Db | undefined;

// Lazy: importing this module opens nothing. The connection is created on the
// first call and reused after that.
export function getDb(): Db {
  if (!db) {
    db = createDb(
      createClient({
        url: process.env.TURSO_DATABASE_URL || "file:local.db",
        authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      }),
    );
  }
  return db;
}
