---
description: Build a feature end to end using the planner, implementer, test-writer and reviewer subagents
argument-hint: <feature description>
---

You are the orchestrator. You coordinate a team of subagents to build this feature:

$ARGUMENTS

You do not write application code or tests yourself. Your job is to hand work to the right agent, pass context between them, and keep score. Subagents cannot see each other's output, so always paste the relevant plan, task and feedback into each prompt.

Follow this process:

1. **Plan.** Use the `planner` subagent with the feature description. Show me the plan, then continue without waiting unless the planner flagged a decision that needs me. Set the feature's status in `docs/ROADMAP.md` to "In progress".
2. **Build each task in order.** For each task in the plan:
   a. Use the `implementer` subagent with the task title, files and acceptance criteria.
   b. Use the `test-writer` subagent with the same task details plus the implementer's summary.
   c. If the test-writer found bugs, send them back to the `implementer`, then rerun the `test-writer`.
   d. Use the `reviewer` subagent with the task details.
   e. If the verdict is CHANGES REQUESTED, send only the "Must fix" items to the `implementer` (and the `test-writer` if tests are affected), then run the `reviewer` again. Allow at most 2 review rounds per task. If it still is not approved, stop and ask me.
   **Don't apply Backlog items during the task.** Add them to the Open table in `docs/BACKLOG.md`, skipping duplicates. Also add the verifier's notes that weren't failures, and anything an agent flags outside the task's scope. Don't ask me about each item. I'll pick them up from the backlog when I choose.
   f. If the task changes something a user can see or do in the browser, use the `verifier` subagent once the reviewer approves. Give it the task details and the specific user flows to check, especially any behaviour that only shows up in a real browser. If the verdict is FAIL, send the failures to the `implementer` as Must fix items (and to the `test-writer` if a regression test is possible), then rerun the `reviewer` and the `verifier`. If a failure's cause isn't obvious, for example the server is right but the browser isn't, use the `debugger` subagent instead of the `implementer`. Give it the verifier's evidence and the hypotheses to check. Allow at most 2 verifier rounds per task. If the verdict is BLOCKED, or it still fails, stop and ask me. Skip this step for tasks with nothing to see, such as a data-layer change.
3. **Log the run.** Create `docs/agent-log/NNN-short-feature-name.md` (next number in sequence) with: the feature request, the plan, and for each task which agents ran, how many review rounds it took, and the most interesting thing the reviewer or test-writer caught. Keep it honest, including what went wrong. When every task in the plan is approved, set the feature's status in `docs/ROADMAP.md` to "Done". If the run stops partway, leave it at "In progress".
**Orchestrator habits.** These are lessons from earlier features:

- **Check before you write it down.** Treat claims about framework or library behaviour as unverified until someone checks the installed source or the docs in `node_modules`. This applies whether the claim came from an agent or from you. In feature #1, an unchecked claim ("the page remounts on every search") went into the plan notes and caused a bug.
- **Watch for conflicting criteria.** When acceptance criteria might conflict, check them against real data. In feature #2, a 50-author cap clashed with real anthologies.
- **Never leave tests skipped.** If tests get skipped because something can't be rendered in jsdom, make the code testable instead. For example, move an async Server Component into its own file and call it directly.
- **Run read-only agents in parallel only when they can't collide.** Two agents running `next build` or `next typegen` at the same time will collide in `.next/`.
- **Clean up after agents.** Delete scratch copies of the repo once you're done with them; they can be hundreds of MB. Also check that no server is left running on port 3100.
- **Keep the developer's database out of it.** The verifier and the debugger use a throwaway database, never `local.db`.

4. **Stop before git.** Never commit, push or open a pull request. Finish with a short summary of what changed and which files I should review in my IDE.
