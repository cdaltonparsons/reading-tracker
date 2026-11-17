# 001: Book search

**Request:** Book search using the Open Library API (Roadmap #1).

**Status:** Done. All 5 tasks passed review and browser verification. `docs/ROADMAP.md` marks Book search as "Done".

**Git:** Task 1 was committed and pushed straight to `main` by mistake. From Task 2 on, each task gets its own feature branch and is merged through a PR.

## Plan

The `planner` split the feature into five tasks:

1. Open Library client and validation (`src/lib/open-library.ts`)
2. Book card and results list, plus `images.remotePatterns` for covers
3. Search form (`next/form`)
4. `/search` page with Suspense, loading and empty states
5. Error state (`error.tsx`) and a link from the home page

The planner recommended a hand-written parser, with Zod to come later alongside Drizzle. Charlie chose to use Zod from the start, so Task 1 was changed to use it.

## Task 1: Open Library client and validation

**Agents:** implementer → test-writer → reviewer (changes requested) → implementer → test-writer → reviewer (approved)

**Review rounds:** 2

**Result:**

- `src/lib/open-library.ts` validates each doc in the response with its own Zod schema, so one bad doc is dropped without failing the whole response.
- The `Book` type is derived from the schema.
- 40 tests in `src/lib/open-library.test.ts` stub `fetch`, so none of them touch the network.
- `zod` was added to `package.json`.
- The test count went up to 56 after the follow-up rounds below.

**Most interesting catch (reviewer, round 1):** in production, `searchBooks` would never have thrown an `OpenLibraryError`.

- **The bug:** Every `throw` sat inside the `"use cache"` function. To find out what happens next, the reviewer read the Next 16 source rather than the docs. Next serializes a cached function's result and rebuilds any error it throws as a plain `Error` with a generic message. The class and the message are lost. Code downstream that checks `instanceof OpenLibraryError` would have failed silently.
- **Why tests missed it:** `"use cache"` does nothing under Vitest, so all the tests passed anyway.
- **The fix:** an uncached public `searchBooks` that normalizes the query and wraps errors, around a private cached `fetchSearch`.
- **Side benefit:** normalizing first means `"dune"` and `" dune "` share one cache entry. A query that is only whitespace no longer triggers a fetch.
- **Also checked:** the reviewer confirmed in the Next source that errors are not cached, so the next request after a brief Open Library outage tries again.

**What went wrong:**

- **Node version:** `npm test` could not start on the machine's default Node (v20.19.6). vitest 5 and jsdom 31 need Node 22 or later, and the existing home page test failed the same way. The implementer reported this instead of working around it. The orchestrator ran the checks with Node 22.23.2 from nvm by setting `PATH` for each command. The default Node was left alone. A `.nvmrc` would prevent this in future.
- **Repo state:** at the start, the orchestrator thought the project wasn't a git repo. Charlie had committed the round-1 files (`ce99263`) partway through the run, and the reviewer noticed this when `git status` came back clean.

**Untested by choice:** wrapping an error that isn't an `OpenLibraryError` into one. It only happens in production, when Next rebuilds a cached error, so Vitest can't easily reach it. The reviewer accepted this because the branch is three lines and easy to check by reading.

### Follow-up: applying the Nice to haves

After the approval, Charlie asked for every Nice to have from both rounds to be applied, since this is a learning project with no deadline.

**Agents:** implementer → test-writer → reviewer (approved)

**Applied:**

- Bad `author_name` entries are filtered out, rather than all authors being dropped.
- The year must be an integer, and the cover ID a positive integer.
- The fetch has an 8-second `AbortSignal.timeout`.
- `key` must match `/works/OL…W`.
- `normalizeQuery` trims again after slicing.
- `unstable_rethrow` is called in the `searchBooks` catch.
- The comment on the wrapper is expanded.
- The User-Agent assertion is stricter.

51 tests pass.

**What happened:**

- **Test fixtures:** the key regex rejected the fake keys in six existing test fixtures (`/works/1`). The implementer flagged this instead of quietly working around it, and the test-writer updated the fixtures.
- **Should `fetchSearch` also call `unstable_rethrow`?** The implementer asked this, and the reviewer said no. It read Next's `patch-fetch.js` and found that nothing inside a `"use cache"` function can throw a Next control-flow error. Request-time APIs throw real errors there, not control-flow errors.
- **A fragile test:** the test-writer's `unstable_rethrow` test got a sentinel error to the outer catch by mocking `response.ok` as a getter that throws. That only works because of where `ok` happens to be read. The orchestrator flagged it, and the reviewer agreed and suggested making the mocked `cacheLife` throw instead.

**Most interesting catch (reviewer):** the outer branch that wraps errors in `OpenLibraryError` is still untested, and it is the only path production errors take. In Vitest, `"use cache"` does nothing, so errors are already `OpenLibraryError`s and go straight through. In production they come back as plain `Error`s and hit the untested branch. Making the mocked `cacheLife` throw a plain `Error` would test it.

### Follow-up 2: the second set of Nice to haves

Charlie asked for items 1 to 5 from the list above. Item 6, splitting the test file, was skipped, because the 150-line guideline is meant for components.

**Agents:** implementer (items 4 and 5) → test-writer (items 1 to 3, plus tests for 4 and 5) → reviewer (approved)

**Applied:**

- An `isTimeout` helper means a timeout is reported as "Open Library timed out", whether it happens during the fetch or while reading the body.
- Titles use `.trim().min(1)`, and author names are trimmed.
- A new test covers the outer wrap branch: `cacheLife` throws a plain `Error`, and the result is "Open Library search failed".
- The sentinel test now uses a throwing `cacheLife`.
- The misleading test is renamed.

56 tests pass.

**Reviewer's check for leaking mocks:** the reviewer ran the test file shuffled with five different seeds. This confirmed that the `mockImplementationOnce` calls on `cacheLife` don't leak between tests.

**Worth remembering for later tasks (reviewer):** in production, errors thrown inside `"use cache"` come back as plain `Error`s. So an "Open Library timed out" message only reaches callers as the `cause` of "Open Library search failed", and Next may strip its text. If the error UI in Task 5 wants a separate timeout message, it can't rely on `err.message` from `searchBooks`.

**Not applied:** one redundant assertion in the timeout test, `not.toBe("...invalid JSON")`.

## Task 2: Book card and results list

**Branch:** `feature/results-list`

**Agents:** implementer → test-writer → reviewer (approved) → implementer → test-writer → reviewer (approved)

**Review rounds:** 1 to approve, plus a confirmation pass after the Nice to haves were applied

**Result:**

- **`BookCard`** (`src/components/book-card.tsx`) is an `<article>` with an `<h3>` title.
  - It shows a 72×108 `next/image` cover.
  - It falls back to "Unknown author" and "Year unknown".
  - When there is no cover it shows a "No cover" placeholder marked `aria-hidden`.
- **`SearchResults`** (`src/components/search-results.tsx`) renders a `<ul>` of cards. Its empty state repeats the query.
- **`next.config.ts`** allows `https://covers.openlibrary.org/b/id/**` in `images.remotePatterns`.
- **Tests:** 73 pass.

**Most interesting catch (test-writer):** the test setup wasn't cleaning up between tests.

- **The problem:** Vitest globals are off, so React Testing Library can't register its automatic `cleanup`. `vitest.setup.ts` didn't call it either. Rendered DOM leaked from one test into the next, and the test-writer's first run had 9 failures because of it.
- **Why it hadn't shown up:** `src/app/page.test.tsx` only has one test, so it had never been hit.
- **The fix:** the test-writer worked around it in its own files and flagged the root cause instead of hiding it. The reviewer recommended a shared `afterEach(cleanup)` in `vitest.setup.ts`, and Charlie approved the change on this branch. The reviewer then ran the suite shuffled five times to confirm it holds.

**Other reviewer findings:**

- **Redirects confirmed:** the docs (`image.md` lines 612 and 821-833) say `next/image` follows redirects from an allowed host without checking `remotePatterns` again. So the archive.org redirect target needs no pattern of its own. This hasn't been tried against the live site yet. Check a real cover in `npm run dev` during Task 4.
- **Config test deleted:** the test-writer's `src/next-config.test.ts` only repeated the config back, and it would have broken on any legitimate config change. Charlie chose to delete it rather than rewrite it.
- **Cover URL test:** the cover `src` assertion built its expected value with `coverUrl` itself, so a bug in `coverUrl` would have gone unnoticed. It now checks a literal URL.

**Decided for Task 4:** the `/search` page renders an `<h2>` above `SearchResults`, because card titles are `<h3>`. It does not render `SearchResults` for an empty query, which would otherwise show `No books found for ""`.

## Task 3: Search form

**Branch:** `feature/book-shelf`

**Agents:** implementer (stopped) → implementer → test-writer → reviewer (changes requested) → implementer → test-writer → reviewer (approved)

**Review rounds:** 2

**Result:**

- `SearchForm` (`src/components/search-form.tsx`) is a Server Component built on `next/form`. It renders `<Form action="/search" role="search">`.
- The search input:
  - has the sr-only label "Search books"
  - is `name="q"` and `type="search"`
  - has `maxLength={200}`, matching `normalizeQuery`
  - takes an optional `defaultQuery`
- The input deliberately has no `required` attribute. The page has to handle empty queries anyway, because `required` accepts `"   "`, and users can open `/search` directly.
- `next/form` renders in jsdom without any mocking.
- **Tests:** 84 pass.

**Most interesting catch (reviewer, round 1):** the search box would show a stale query.

- **The bug:** the App Router re-renders the same page in place when you go from `/search?q=a` to `/search?q=b`, including on Back and Forward. So `SearchForm` is not remounted. An uncontrolled input only takes a new `defaultValue` if the user hasn't typed in it yet. So if you search "a", type "b", submit, then press Back, the results show "a" but the box still says "b".
- **Who spotted it:** the orchestrator suspected this and asked the reviewer to check. The reviewer confirmed it by reasoning through how React and HTML handle this.
- **The fix:** `key={defaultQuery ?? ""}` on the input. The key goes on the input, not on `<Form>`, because the `next/form` docs say a `key` on a string-action `<Form>` isn't supported.
- **Proving the test works:** the test-writer showed that jsdom reproduces the bug. In a scratch test, an input without the key kept "typed" when it should have shown "c". So the new regression test really does prove the fix.

**What went wrong:**

- **Files moved by accident:** the first implementer run was stopped. While it was running, Charlie had accidentally dragged the Task 2 components into `src/app/components/`, and that implementer put its partial `search-form.tsx` there too. Charlie moved the files back and discarded the partial file, and Task 3 was restarted. This happened when Charlie stopped to ask why book search was "being built again". The confusion came from two places:
  - The orchestrator's "Task 1/Task 2" labels were easy to read as features.
  - `docs/ROADMAP.md` still said "Not started".

  Fixes:
  - The roadmap now says "In progress".
  - `/build-feature` now updates the roadmap at the start and end of each feature.
- **Session ended mid-review:** the round 1 review stopped when the session ended. It was resumed from its saved transcript.
- **The reviewer contradicted itself:** in round 1, the reviewer quoted the docs on `key` and `<Form>`. In round 2, it called the code comment that says the same thing "wrong". The orchestrator checked `form.md` (line 156), which confirms the comment is right, so that suggestion was not applied.

**Also applied (Charlie approved):**

- `outline-hidden` instead of `outline-none`, so the focus outline still shows in Windows High Contrast mode.
- `border-zinc-500` for 3:1 border contrast. The implementer also changed the focus border to `zinc-700`.
- Removed two low-value tests.

## Task 4: `/search` page

**Branch:** `feature/search-form`. It is stacked on the unmerged Task 3 branch, because Charlie is holding the PRs until the feature is complete.

**Agents:**

1. implementer → test-writer → reviewer (changes requested), with a reviewer test audit running in parallel
2. implementer, plus a second implementer for the heading wrap → test-writer → reviewer (approved) → test-writer (cleanup)
3. **verifier round 1 (FAIL)** → implementer → test-writer → reviewer (changes requested) → implementer → test-writer → reviewer (approved)
4. **verifier round 2 (FAIL)** → Charlie approved a third round → implementer (redesign) → test-writer → reviewer (changes requested) → implementer → test-writer → reviewer (approved)
5. **verifier round 3 (PASS)**

**Review rounds:** 2 before the verifier existed, then 2 more for each verifier failure. **Verifier rounds:** 3. That is one over the limit, with Charlie's approval.

**Result:**

- **Page and layout:**
  - `src/app/search/layout.tsx` holds the `<h1>` and the search form, so the form persists across searches.
  - `src/app/search/page.tsx` only renders the results.
  - Neither is async, so the `<h1>` is part of the prerendered shell, and the build reports `/search` as `◐ Partial Prerender`.
- **The search box:**
  - It shows an empty `SearchForm` until `SearchBox` takes over.
  - `SearchBox` is a `"use client"` controlled input. It reads `q` with `useSearchParams()` and keeps the user's text if they edited it after submitting.
- **The results:** the page shows `ResultsSkeleton` until `Results` is ready. `Results` is an async Server Component that shows a prompt for an empty query, or an `<h2>` "Results for “…”" followed by `SearchResults`.
- **The search button:** `SearchButton` uses `useFormStatus` to show "Searching…" during a search, plus an sr-only `role="status"`.
- **Shared query code:** `normalizeQuery` moved to a client-safe `src/lib/query.ts`, and `open-library.ts` re-exports it.
- **Live check:** the implementer ran `next start` against the real API. `/search?q=dune` returned 20 results, and a cover image loaded through `/_next/image` with a 200. That confirms the Task 2 assumption that the archive.org redirect needs no extra `remotePatterns` entry.
- **Tests:** 88 pass. The audit below cut 106 down to 72, and the verifier fixes then added tests.

**Most interesting catch (reviewer, round 1):** the search box went blank on every search.

- **The cause:** the first version filled the box from a Server Component, `QueryForm`, which read `searchParams`. Next's docs (`optimizing-the-static-shell.md`, Step 5) say server content that depends on `searchParams` isn't part of the shared shell during client navigation. So every submit showed the empty fallback form for a full server round trip, then filled it back in.
- **The fix:** read the query on the client with `useSearchParams()`, which the docs say resolves synchronously during client navigation.
- **Why the tests missed it:** they render components in isolation, so they can't see navigation behaviour.
- **What the orchestrator asked:** whether text typed into the fallback form would be lost during the swap. The reviewer said yes, because React mounts the resolved content as a new subtree. After the fix, that only matters during the first page load.

**The test audit:** Charlie asked whether 106 tests was really justified for this much functionality. A separate reviewer audited every test with one question: what realistic regression would make this test fail, and would another test already catch it? It found about 38 tests not earning their place:

- **About 12 tested libraries instead of our code:** React's escaping, Zod rejecting non-objects, jsdom's `FormData`.
- **About 6 repeated `normalizeQuery` tests:** it was tested at three separate layers.
- **About 5 restated the markup:** "is an `<article>`", "heading before form".
- **The rest:** duplicates, and tests of implementation details such as "`unstable_rethrow` was called" or "`cacheLife('hours')`".

Charlie approved every cut and merge, including the judgement calls. The core stayed:

- the `searchBooks` error and timeout paths
- per-doc schema validation
- the keyed-input regression tests
- the static-shell check

The new tests for `CurrentQueryForm` and the real Suspense skeleton made up for the cuts. The audit also found that the year-0 test's comment was wrong. The schema does accept year 0, so that guard was worth keeping.

**What went wrong:**

- **The audit and the fix ran at the same time.** The refactor changed the code while the audit was reading it. The audit noticed, noted which findings it affected, and the orchestrator held the test-writer back so it could do the fix and the cuts in one pass.
- **A broken build in the meantime.** The implementer wasn't allowed to edit tests, so the repo failed typecheck until the test-writer caught up. To verify the build, the implementer made a 569 MB copy of the repo in the scratchpad. The orchestrator deleted it afterwards.
- **A leftover test-output file.** A vitest JSON report (`.vitest/json/output.json`) was left in the repo by an agent's test run. The reviewer flagged it and the orchestrator deleted it.
- **A deviation caught in review.** The test-writer kept two explicit-null rows that Charlie had approved cutting, by folding them into a merged table. The reviewer caught this, and the rows were removed.

**Also applied (Charlie approved):** `wrap-anywhere` on the results `<h2>`, so a long query with no spaces wraps instead of overflowing on mobile.

### Browser verification

Midway through Task 4, Charlie added a new agent, the **`verifier`**. It builds the app, starts it on port 3100 and drives real user flows in headless Chromium with Playwright. It's read-only, like the reviewer. Playwright was added as a dev dependency. Every agent had missed the bugs below, because unit tests render components in isolation and can't see navigation, timing or layout.

**Round 1 (FAIL):**

- **What passed:** the round 1 reviewer fix held up. The box never went blank or stale across searching, searching again, Back, Forward, and typing then pressing Back. It sampled the box every 50 ms.
- **The failure:** at 375 px, a 200-character query with no spaces and no results made the page 1819 px wide. The "No books found" message couldn't wrap. `<main>` (`mx-auto` inside a `flex flex-col` body) sized itself to its content.
  - **Fix:** `wrap-anywhere` on that message and on the book card text, and `w-full` on `<main>`.
- **A note that wasn't a failure:** new searches showed no loading feedback for 3 to 5 seconds, because the skeleton only appears on a direct page load. Charlie chose to fix it with a `useFormStatus` pending button.
- **A bug the reviewer caught in that button:** the first version blocked repeat clicks while pending. Pressing Enter in a field clicks the default submit button, so the guard also blocked Enter. That silently dropped a corrected search, and the user's edit was then wiped when the earlier search finished. The guard was removed, since a repeat GET navigation is harmless.

**Round 2 (FAIL):**

- **What passed:** overflow, the pending state, and a correction submitted before the first search finished.
- **The failure:** if the first search *finished while the user was still typing* a correction, the box was wiped to the old query and focus moved to `<body>`. Every remaining keystroke went nowhere, and spaces scrolled the page.
- **The cause:** Task 3's own fix, `key={defaultQuery}` on the input, which remounted it on every query change. That same key is why focus had always left the box after a search.
- **What it took to fix:** this was the second verifier failure, which hit the round limit. Charlie chose to fix it in Task 4 rather than as a separate task.
  - The form moved into a persistent `layout.tsx`. Layouts don't re-render when only `searchParams` change.
  - The input became a controlled `SearchBox` that tracks "submitted" and "edited since submit".
  - The reviewer's round on the redesign caught one more case. A submit that only changed whitespace (`"  dune "` on `?q=dune`) left the raw text in the box, because the normalised query didn't change.

**Round 3 (PASS):**

- The correction-while-finishing case passed. Over 56 samples the box only showed what the user typed, focus stayed on the same input element throughout, and Enter submitted the correction.
- Focus after a plain search, Back and Forward over unsubmitted text, the whitespace resubmit, and the earlier fixes also passed.

### Process change: the backlog

During this task, Charlie noticed that reviewer "Nice to have" items were growing every task. Each one became another round.

- **New file:** `docs/BACKLOG.md` now holds those follow-ups.
- **Reviewer:** its definition has "Must fix" for real defects only (unmet criteria, bugs, security, broken conventions, failing checks) and "Backlog" for everything else. It reads the backlog first to avoid repeating items.
- **`/build-feature`:** now says Backlog items are never applied during a task, and the orchestrator doesn't ask about each one.
- **Seeding:** the backlog started with 7 earlier unapplied suggestions. By the end of the task it had 12 open items, and one was done (focus after a search).

**What went wrong (continued):**

- **Session restarts stopped agents twice.** Each time the agent resumed from its saved transcript. The second time, the verifier had left `next start` running on port 3100. The orchestrator checked the process was the verifier's before stopping it.
- **Flaky upstream connections.** The verifier saw three `ECONNRESET` errors from Open Library in about 15 searches, each on the first call after a quiet minute. They didn't affect the verdict and are now in the backlog as "retry once".
- **A bigger PR.** Task 4 grew well beyond its plan. It now includes the verifier agent, Playwright, the backlog change, and a redesign of Task 3's input. Charlie chose to keep it all on one branch.

**Decided for Task 5:** Charlie chose to wrap only the results in a `catchError` boundary from `next/error`, instead of using a segment-level `error.tsx`. That way the heading and search box stay visible when Open Library fails. Things to remember when building it:

- **Put the boundary in `page.tsx`, around `<Results>`, not in the layout.** `catchError` only resets on navigation to a different route. The page remounts on every query change and the layout doesn't, so a boundary in the layout could keep showing an old error after a new search. (From the reviewer, round 3.)
  - **Correction, from Task 5:** the claim that the page remounts on every query change was wrong. The orchestrator copied it into these notes without checking. See Task 5 below.
- **Don't build UI that relies on the timeout message.** In production, the error only reaches the page as "Open Library search failed". (Task 1 note.)
- **Test it with the verifier.** An upstream failure currently shows Next's generic "This page couldn't load" screen, plus React error #441 in the console.

## Task 5: Error state and home-page link

**Branch:** `feature/search-cont`, based on `main` after Charlie merged the Task 3 and Task 4 stack (#2, then #3) with GitHub's new pull request stacks feature.

**Agents:**

1. implementer → test-writer → reviewer (changes requested)
2. implementer → test-writer (6 tests skipped) → implementer (an export, which Charlie declined at the permission prompt) → implementer (moved `BookResults` into its own file, at Charlie's choice) → test-writer → reviewer (approved)
3. verifier (PASS)

**Review rounds:** 2. **Verifier rounds:** 1.

**Result:**

- **Error boundary.** `src/components/results-error-boundary.tsx` is the only `"use client"` file. It is `catchError(ResultsError)` from `next/error`.
  - The fallback ignores the error and shows a `role="alert"` reading "Couldn't reach Open Library. Please try again."
  - It has a "Try again" button that calls `retry()`. Per the docs, `retry()` re-fetches the server data, while `reset()` only clears the state.
- **Results.** In `src/app/search/results.tsx`, `Results` normalises `q` and renders `<ResultsErrorBoundary key={q}><Suspense><BookResults q={q} /></Suspense></ResultsErrorBoundary>`. `page.tsx` keeps an outer `Suspense`, so the skeleton stays in the static shell.
- **`BookResults`.** It lives in `src/components/book-results.tsx` and does the fetch and the rendering.
- **Home page link.** The home page links to `/search` ("Search books").
- **Tests:** 98 pass, with 0 skipped.

**Most interesting catch (reviewer, round 1):** a new search after an error left the error on screen. The fix was based on a wrong idea from Task 4, which the orchestrator had copied into the Task 5 notes: that the page segment remounts on every query change. The reviewer read the Next 16.4.5 source and found two things:

- `catchError` only resets when the pathname changes (`catch-error.js`), and `/search?q=a` → `/search?q=b` keeps the pathname `/search`.
- Page segments keep their state across navigations that only change search params (`layout-router.js:361-365`: "search params do not cause state to be lost").

So the boundary survived and kept its error. The fix was a `key` on the boundary, set to the normalised query. The same wrong comment is still in `layout.tsx`, and is in the backlog. The Task 4 search box design wasn't affected, because it relies on the layout persisting, and that part is true.

**What went wrong:**

- **Skipped tests.** Moving the error boundary inside `Results` put an async Server Component (`BookResults`) inside the tree, and jsdom with React 19 can't render that. The test-writer correctly skipped 6 tests instead of forcing them, but that would have meant coverage had dropped.
  - The orchestrator's first fix exported `BookResults` from `results.tsx`. Charlie declined the implementer's lint run at the permission prompt.
  - The implementer pointed out that exporting widened the module's public surface just for tests.
  - Charlie chose to move `BookResults` into its own file instead. The tests call it directly, and the boundary-key behaviour is covered by synchronous boundary tests plus a key test on `Results`.
- **An unchecked claim in the notes.** The orchestrator copied a reviewer's claim into the plan notes without verifying it, and the wrong comment went into the code. Treat source-level claims about framework behaviour as unverified until someone checks the source or the docs.

**Verifier highlights:** to force Open Library failures, the verifier used a `NODE_OPTIONS=--require` preload outside the repo, with a flag file to switch them on and off, so no test-only code went into the app. Its results:

- The friendly alert replaced Next's crash screen.
- "Try again" did a real refetch.
- A new search cleared the alert. In 63 samples, the alert never lingered after the new results rendered.
- A direct load into an error showed the heading, the box and the alert, not a whole-page error.
- All the Task 4 regressions passed.
- React #441 now only appears in the console, never on the page.

**Backlog additions:**

- searching the same query again doesn't clear the error
- a brittle prop test
- focus after "Try again"
- no results with JavaScript off
- checking the "No cover" placeholder is visible

## Wrap-up

- **Book search is done:** 5 tasks, 98 tests, and every task with something to see was verified in a real browser.
- **New agent:** the feature also produced the `verifier`.
- **New process:** reviewer findings now split into "Must fix" and "Backlog".
- **Clean-ups:** a 106 → 72 test audit, and a roadmap step in `/build-feature`.
- **Bugs only the verifier caught:** the mobile overflow, missing loading feedback, and a wiped correction with lost focus. Unit tests couldn't see any of them.
- **A bug the reviewer caught in the source:** the stuck error alert, found by reading the Next source.
- **What's left:** the open follow-ups are in `docs/BACKLOG.md`.
