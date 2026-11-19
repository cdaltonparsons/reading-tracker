import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { SHELVES } from "@/lib/shelf";

// One row per book, keyed by the Open Library work id. Book details are a
// snapshot copied from search at the time the book was shelved.
export const books = sqliteTable(
  "books",
  {
    // Full "/works/OL…W", the same as Book.id in open-library.ts.
    workId: text("work_id").primaryKey(),
    title: text("title").notNull(),
    authors: text("authors", { mode: "json" }).$type<string[]>().notNull(),
    year: integer("year"),
    coverId: integer("cover_id"),
    shelf: text("shelf", { enum: SHELVES }).notNull(),
    // Milliseconds since epoch, set by the data layer.
    addedAt: integer("added_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check(
      "books_shelf_check",
      sql`${table.shelf} IN (${sql.join(
        SHELVES.map((s) => sql.raw(`'${s}'`)),
        sql`, `,
      )})`,
    ),
  ],
);

export type BookRow = typeof books.$inferSelect;
export type NewBookRow = typeof books.$inferInsert;
