# 001: Book search

**Request:** Book search using the Open Library API (Roadmap #1).

**Status:** Task 1 of 5 done. Tasks 2 to 5 are not started.

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
