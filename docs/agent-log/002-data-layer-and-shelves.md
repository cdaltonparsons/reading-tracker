# 002: Data layer and shelves

**Request:** Set up Drizzle with libSQL, and add a book from search to a shelf: Want to read, Reading, or Finished (Roadmap #2).

**Status:** Done. All 5 tasks passed review, and Task 5 passed browser verification. `docs/ROADMAP.md` marks #2 as "Done".

**Branch:** `feature/data-layer`

## Plan

The `planner` split the feature into five tasks:

1. Install Drizzle and libSQL, then add the schema, the first migration, a lazy database client and `.env.example`.
2. Data access: `setShelf` (upsert) and `getShelvesFor(ids)`, plus a Zod `bookSchema`.
3. The `setShelfAction` Server Action. It validates its input, saves, calls `refresh()` and never throws.
4. `ShelfControl`, three `aria-pressed` buttons that update straight away through `useOptimistic`.
5. Show shelves on search results. Only this task goes to the verifier.

**Decisions:**

- **Snapshot schema.** One `books` table keyed by work id. It stores the title, authors, year and cover, so the shelves page (#3) and stats (#6) don't depend on Open Library.
- **Migrations.** `drizzle-kit generate`, committed to the repo.
- **Shelf lookup.** A single `IN (…)` query inside `BookResults`, which is already dynamic, so `/search` stays Partial Prerender.

**Charlie's calls:**

- Removing a book from a shelf waits for #3.
- The verifier gets permanent temp-database steps, and `CLAUDE.md` lists the new `db:*` commands.
- The implementer may add a README "Database" section.

**Open for #7 (deploy):** with no login, anyone could call the save action once the app is public. Options are basic auth, a shared secret, or accepting it. This doesn't block #2.

## Task 1: Database setup

**Agents:** implementer → test-writer → reviewer (approved)

**Review rounds:** 1

**Result:**

- **Packages:** drizzle-orm 0.45.4, @libsql/client 0.18.0 and drizzle-kit 0.31.11.
- **Config:** `dialect: "turso"`, with the database URL taken from `TURSO_DATABASE_URL` and defaulting to `file:local.db`. The `db:generate` and `db:migrate` scripts are added.
- **`books` table:**
  - The work id is the primary key.
  - Authors are stored as JSON.
  - A database-level CHECK constraint limits `shelf` to the three values, built from `SHELVES` in the client-safe `src/lib/shelf.ts`.
- **Client:** `getDb()` creates the client lazily, and `createDb(client)` lets tests inject their own database.
- **Tests:** 109 pass. Each test gets a fresh migrated in-memory database from `createTestDb()`.

**What the planner's risk turned out to be:** the planner worried that in-memory libSQL would open a separate, empty connection for transactions. The implementer checked, and in-memory works with both `migrate()` and transactions, so no temp files are needed.

**Reviewer's checks:**

- It ran `db:migrate` in a fresh copy of the repo with no env files.
- It confirmed `db:generate` reports "No schema changes", so the committed migration matches the schema.
- It confirmed the CHECK constraint with the `sqlite3` CLI, and confirmed the gitignore rules.

It also left 9 backlog items, several of them due before #7:

- `db:migrate` loads production env files.
- A missing Turso URL in production silently falls back to the local file.
- Nothing catches schema changes that have no migration.

## Task 2: Shelf data access

**Agents:** implementer → test-writer → reviewer (changes requested) → implementer → test-writer → reviewer (approved)

**Review rounds:** 2

**Result:**

- **`src/lib/shelves.ts`:**
  - `setShelf` is a single upsert (`onConflictDoUpdate` on `work_id`). `addedAt` is only in the insert values, so moving a book never changes it.
  - `getShelvesFor` uses one `IN` query and skips the database for an empty list.
  - Both functions take an optional `db` and pass errors up to the caller.
- **`src/lib/book.ts`:** `bookSchema` is the strict validator for input from the browser. Compile-time checks keep it and the `Book` type in step.
- **`src/lib/book-limits.ts`:** shared size limits.
- **Tests:** 144 pass.

**Most interesting catch (reviewer, round 1): real books that couldn't be shelved.**

- **The conflict:** the plan asked for two things that contradicted each other. `bookSchema` had to accept every parsed search result, and it also had to cap authors at 50.
- **The evidence:** the reviewer searched Open Library for "short stories" and found anthologies with 51, 69 and 70 authors. Once Task 3 validated saves, those books couldn't have been shelved.
- **The fix:** the parser now cuts titles, author names and author lists to limits shared with `bookSchema`, so every parsed book is guaranteed to be saveable.
- **The test:** a contract test runs a doc that breaks every limit through the real parser and into `bookSchema`.
- **The lesson:** when acceptance criteria could conflict, check them against real data. The reviewer did that by sampling the live API, which tests never do.

## Task 3: Server Action

**Agents:** implementer → test-writer → reviewer (approved)

**Review rounds:** 1

**Result:**

- **`setShelfAction`** in `src/app/actions/shelves.ts` (`"use server"`). It treats its input as untrusted and validates it with `safeParse` against `{ book: bookSchema, shelf: z.enum(SHELVES) }`.
- **Saving:** only `setShelf` is inside the `try`. A database error is logged and returns `{ ok: false }`, so the action never throws. A thrown error would have shown "Couldn't reach Open Library".
- **Refreshing:** `refresh()` runs after a successful save. The docs confirm it re-renders the page in the same round trip, which Task 4's optimistic UI relies on.
- **Tests:** 159 pass. They include a 10-row table of invalid inputs and a database failure that must not leak error text.

**Things worth noting:**

- **A wrong test idea, caught before it was written:** the implementer suggested testing that "an extra field is rejected". The orchestrator flagged that Zod's `z.object` strips unknown keys rather than rejecting them, and asked the test-writer to check the real behaviour. The keys are stripped, and the test now proves they never reach the database.
- **Security, deferred to #7:** the reviewer confirmed the input limits make the action safe for now. It noted two things to settle before deploy: anyone could add unlimited rows, and anyone could overwrite a shelved book's stored details. Both are in the backlog, alongside the open no-login question.

## Task 4: ShelfControl

**Agents:** implementer → test-writer → reviewer (approved)

**Review rounds:** 1

**Result:**

- **`src/components/shelf-control.tsx`** (`"use client"`, 82 lines) shows three `aria-pressed` buttons in a group named "Shelf for {title}".
- **Optimistic updates:** it uses `useOptimistic` and `useTransition`, following the docs. A failure, whether `{ ok: false }` or a rejected call, reverts the button and shows a `role="alert"`.
- **Clicking the current shelf** does nothing.
- **Buttons are never disabled.** A `latestSave` ref makes sure only the newest save updates the messages.
- **Screen readers:** an always-present sr-only status reads "Saved to {label}".
- **Tests:** 173 pass.

**Most interesting finding (reviewer):** the implementer assumed that overlapping clicks would settle on the last one. The reviewer checked that in the installed React 19.3.0 and Next 16.4.5 source:

- React puts all pending async transitions in one shared scope. An optimistic value only reverts once every pending transition has settled, so the second click's value stays on screen.
- Next queues Server Actions on the client and sends them one at a time. The last thing saved is always the last click.
- The tests for out-of-order resolution therefore cover a case real Next can't produce. They're kept as a harmless safety net.

**The gap jsdom leaves:** in jsdom, a successful save also falls back to the old prop, because there's no server `refresh()`. So "the button stays pressed after saving" can only be checked in a browser. That went on the verifier's list for Task 5.

## Task 5: Shelves on search results

**Agents:** implementer → test-writer → reviewer (approved) → verifier round 1 (FAIL) → debugger (stopped by Charlie mid-run, after it had applied its fix) → verifier round 2 (PASS)

**Review rounds:** 1. Charlie chose to skip a re-review of the one-line fix and go straight to the verifier. **Verifier rounds:** 2.

**Result:**

- **Shelf lookup:** `BookResults` calls `getShelvesFor(ids)` after the search. It skips the call when there are no results.
- **When the lookup fails:** only that call is caught. The results still render, without controls, plus "Shelves are unavailable right now." The Open Library alert stays reserved for search failures.
- **Cards:** `BookCard` takes `shelf: Shelf | null | undefined`. `undefined` means shelves are unavailable, so the card shows no control.
- **Tests:** 181 pass.

**Most interesting catch (verifier round 1): saves that didn't stick on screen.**

- **What happened:** clicking a shelf saved correctly, and the action's response contained the new shelf. But about 70 ms later the button reverted and stayed wrong until a full reload. Moving a book showed the old shelf, and three rapid clicks settled on nothing.
- **Why nothing earlier caught it:** every earlier check passed. Unit tests can't see router behaviour, and the reviewer had reasoned the flow was correct.
- **The cause:** the `debugger` found that a local SQLite read is fast enough to finish while Next is prerendering. Next then treats that part of the page as static output, so after `refresh()` the client router kept the prerendered version and ignored the fresh shelf data.
- **The fix:** `await connection()` (from `next/server`) just before `getShelvesFor` in `book-results.tsx`, which marks the read as request-time data.
- **The confirmation:** verifier round 2 confirmed the fix. Every button stayed pressed, moves and rapid clicks matched the database, and Back showed the saved shelf. With saves deliberately delayed so they finished in reverse order, the last click still won. `/search` is still `◐ Partial Prerender`.

**What went wrong:**

- **The debugger ran long.** Charlie paused it. Its last step had already applied the fix and a test mock, but it never re-ran its own browser check. Round 2 of the verifier was the first real confirmation.
- **Its fix wasn't re-reviewed.** Charlie chose to go straight to the verifier, so no reviewer has read the `connection()` change.
- **The verifier's failure trick didn't work.** Its definition said to force a database failure with `chmod 444`, but that has no effect on a running server, because the file is already open. The verifier used blocking SQLite triggers instead, and its definition now says so.
- **Scratch copies.** The agents left about 1.4 GB of repo copies in the scratchpad across Tasks 1 and 5. The orchestrator deleted them. "Clean up after agents" is now in the `/build-feature` orchestrator habits.

## Wrap-up

- **What #2 delivered:** Drizzle with libSQL (a local file in development, Turso-ready by environment variables), committed migrations, a validated Server Action, an optimistic shelf control, and shelves on every search result. That's 5 tasks and 181 tests.
- **Rounds:** the reviewer requested changes once, in Task 2 (the 50-author cap clashed with real anthologies). The verifier failed once, in Task 5 (the prerender bug).
- **Process changes during #2:**
  - the verifier got permanent throwaway-database steps
  - the `debugger` was used for the first time and added to `CLAUDE.md` and `/build-feature`
  - `.nvmrc` pins Node 22
  - `/build-feature` gained an "Orchestrator habits" section, so a new session starts with these lessons
- **Before #7 (deploy):** the backlog has the open items, including protecting writes with no login, rate-limiting saves, failing fast without a Turso URL in production, and `db:migrate` reading the wrong env files.
