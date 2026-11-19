import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "./client";

// A fresh, migrated, in-memory database. Use one per test.
export async function createTestDb() {
  const client = createClient({ url: ":memory:" });
  const db = createDb(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, close: () => client.close() };
}
