# Reading Tracker

@AGENTS.md

A personal reading tracker built with Next.js. The app is real, but the main point of this repo is to practice multi-agent development with Claude Code subagents. See `README.md` for the why.

## How work happens here

Features are built with the `/build-feature` command, which runs the subagents in `.claude/agents/`:

- `planner` breaks a feature into small tasks
- `implementer` writes application code for one task
- `test-writer` writes tests and never touches app code
- `reviewer` reviews the diff and returns APPROVE or CHANGES REQUESTED

The human (Charlie) reviews every change in their IDE and makes every commit. **No agent ever runs `git commit`, `git push`, or opens a pull request.**

Each feature run is written up in `docs/agent-log/`. The planned features are in `docs/ROADMAP.md`.

## Stack

- Next.js (App Router) with TypeScript in strict mode, source in `src/`
- Tailwind CSS for styling
- Vitest and React Testing Library for tests
- Book data comes from the free Open Library API (https://openlibrary.org/developers/api). No API key needed.
- Data layer (planned): Drizzle ORM with libSQL. A local SQLite file in development, Turso in production. Single user, no login.

## Commands

- `npm run dev` starts the dev server
- `npm run check` runs lint, typecheck and tests. It must pass before a task is done.
- `npm test` runs tests only
- `npm run build` makes a production build

## Conventions

- Prefer Server Components. Add `"use client"` only for components that need state or browser events.
- Put data access and external API calls in `src/lib/`, never directly in components.
- Validate anything that comes from the user or an external API before using it.
- Tests live next to the file they test, named `*.test.ts` or `*.test.tsx`. Tests never hit the real network.
- Keep components small. If a file passes about 150 lines, consider splitting it.
- Every page needs loading, empty and error states.
