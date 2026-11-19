// Client-safe: no server-only, Drizzle or Zod imports. Client components
// import from here rather than from the db modules.
export const SHELVES = ["want_to_read", "reading", "finished"] as const;

export type Shelf = (typeof SHELVES)[number];

export const SHELF_LABELS: Record<Shelf, string> = {
  want_to_read: "Want to read",
  reading: "Reading",
  finished: "Finished",
};
