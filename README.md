# Reading Tracker

A small web app for tracking the books I want to read, am reading, and have finished.

**The app is real and I use it, but it is not the point of this repo.** I built it to learn how to develop software with a team of AI agents instead of a single AI assistant. The code is written, tested and reviewed almost entirely by Claude Code subagents that I designed. My job is the part a tech lead does: defining the roles, breaking down the work, reviewing every diff, and deciding what gets merged.

## Why I built this

Before this project, I used AI coding tools the way most people do. I gave one assistant one task at a time and checked the result. I wanted to understand the next step: how to split work across several specialized agents, how to make them check each other, and where that process breaks down.

A reading tracker is a deliberately simple product. Keeping the product simple means the interesting problems are in the process, not the domain.

## How it is built

The agents live in [`.claude/agents/`](.claude/agents/). Each one is a markdown file with a role, a limited set of tools, and plain-English instructions.

| Agent | Job | Can edit code? |
|-------|-----|----------------|
| `planner` | Breaks a feature into small tasks with acceptance criteria | No |
| `implementer` | Writes application code for one task | Yes, app code only |
| `test-writer` | Writes tests that prove the acceptance criteria | Yes, tests only |
| `reviewer` | Reviews the diff and approves or requests changes | No |

A custom command, [`/build-feature`](.claude/commands/build-feature.md), acts as the orchestrator. It runs the planner, then sends each task through implementer, test-writer and reviewer, looping back when the reviewer requests changes (with a cap so it cannot loop forever).

A few design choices were intentional:

- **Separation of duties.** The agent that writes the code is never the agent that tests or approves it, the same reason human teams do code review.
- **Least privilege.** The planner and reviewer are read-only. The test-writer is told never to fix app code, so a real bug shows up as a failing test instead of being quietly patched.
- **A human gate.** No agent can commit. I review every change locally in my IDE and make every commit myself.

Every feature run is written up in [`docs/agent-log/`](docs/agent-log/), including the mistakes. The plan for upcoming features is in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What I learned

- the review agent and test agent seem to be much more reliable than a single agent workflow.  Both found high priority fixes in their first pass.

- The review agent LOVES making suggestions.  I need to work on finetuning it so that it won't ALWAYS turn up a bunch of potential improvements. That could maybe split out into a 'shine and polish' agent or something similar

- Task two was relatively straightforward with the addition of some fairly basic componentry.  The agents seemed to have done a bang-up job.

_In progress. I add to this after each feature._

## Tech stack

Next.js (App Router), TypeScript, Tailwind CSS, Vitest, React Testing Library. Book data comes from the [Open Library API](https://openlibrary.org/developers/api). GitHub Actions runs lint, typecheck, tests and a build on every push and pull request.

## Running it locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run check   # lint, typecheck and tests
```

To build a feature with the agent team, open the project in Claude Code and run:

```
/build-feature <describe the feature>
```
