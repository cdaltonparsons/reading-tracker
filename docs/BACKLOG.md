# Backlog

These are small follow-ups that came up during feature runs but weren't needed to finish the task, for example reviewer "Backlog" items or verifier notes that weren't failures. They are not done as part of the task where they came up. Charlie decides when to pick them up, either as their own task or alongside a related feature.

Bigger features belong in `docs/ROADMAP.md`.

## Open

| Item | Where | Why it matters | Source |
|---|---|---|---|
| Announce when results arrive | `src/app/search/results.tsx` | Screen reader users hear "Searching…" but nothing when results load. | Book search, Task 4 review |
| Remove redundant `aria-live` on the skeleton | `src/app/search/results.tsx:28` | `role="status"` already implies `aria-live="polite"`. This is harmless noise. | Book search, Task 4 review |
| Use `MAX_QUERY_LENGTH` in the search form | `src/components/search-form.tsx:18` | The form hard-codes `maxLength={200}`, so it could drift from `normalizeQuery`'s limit in `src/lib/query.ts`. | Book search, Task 4 review |
| Handle duplicate works from Open Library | `src/lib/open-library.ts` | If the API returns the same work twice, React gets duplicate keys. Either dedupe the results or decide to ignore it. | Book search, test audit |
| Remove redundant timeout assertion | `src/lib/open-library.test.ts:247` | The `not.toBe("…invalid JSON")` line repeats the exact-message check on the line above it. | Book search, Task 1 review |
| Check the status region is outside the button while pending | `src/components/search-button.test.tsx` | The "is outside the button" test only runs in the idle state. | Book search, Task 4 review |
| Brief empty search box on a direct page load | `src/app/search/` | On a full load of `/search?q=…`, the box is empty for about 270 ms until the JavaScript loads and fills it in. The prerendered fallback can't read the query. This is expected, but it could be avoided if the server rendered the query into the fallback without blocking the static shell. | Book search, Task 4 verifier |
| Text typed before the JavaScript loads is lost | `src/app/search/layout.tsx:13` | On a slow page load, anything typed into the prerendered fallback form is thrown away when `SearchBox` replaces it, and focus is lost too. | Book search, Task 4 review |
| Make `layout.test.tsx` mock cleanup failure-proof | `src/app/search/layout.test.tsx:35-47` | Move `vi.doUnmock` / `vi.resetModules` into an `afterEach`, so a failing assertion can't leave the mock in place for tests added later. | Book search, Task 4 review |
| Trim the query before it goes into the URL | `src/components/search-form.tsx` | Submitting a query that only differs by whitespace (e.g. `"  dune "`) adds a new history entry like `?q=++dune+`, which shows the same results. Trimming before submitting would keep URLs clean and avoid an extra press of Back. | Book search, Task 4 review |
| Retry once when the Open Library connection resets | `src/lib/open-library.ts` | In about 15 searches, the verifier saw 3 `ECONNRESET` / `fetch failed` errors from the server's call to Open Library, each on the first call after a quiet minute, while curl kept succeeding. A reused keep-alive connection had probably gone stale. One retry on a connection error would hide most of these. | Book search, Task 4 verifier |
| Searches before the JavaScript loads do a full page load | `src/components/search-form.tsx` | If you press Enter within about a second of a slow page load, the browser does a plain GET request. There's no pending state and the box is briefly blank. This is the plain HTML form working without JavaScript, which is fine. Worth knowing if it ever looks odd. | Book search, Task 4 verifier |

## Done

Move finished items here with the PR or date they were done in.

- **Keep focus in the search box after a search.** Fixed in Book search Task 4, round 3 (2026-11-17). The form moved into `src/app/search/layout.tsx` and the box became a controlled `SearchBox`. The verifier confirmed focus stays put.
