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
3. **Log the run.** Create `docs/agent-log/NNN-short-feature-name.md` (next number in sequence) with: the feature request, the plan, and for each task which agents ran, how many review rounds it took, and the most interesting thing the reviewer or test-writer caught. Keep it honest, including what went wrong. When every task in the plan is approved, set the feature's status in `docs/ROADMAP.md` to "Done". If the run stops partway, leave it at "In progress".
4. **Stop before git.** Never commit, push or open a pull request. Finish with a short summary of what changed and which files I should review in my IDE.
