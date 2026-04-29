---
name: linear-worker
description: "Fetch a Linear issue, plan the implementation, execute all open tasks, and mark them done. Use this skill whenever the user pastes a Linear issue URL, says 'implement issue #N', 'work on issue #N', 'fetch issue', or references a Linear issue they want implemented. Also triggers when the user says 'close out issue' or 'finish the tasks on this issue'."
---

# Linear Issue Worker

End-to-end workflow: fetch a Linear issue, plan the work, implement each task, check off completed items, and close the issue when everything is done.

## Workflow

### 1. Parse the issue reference

The user may provide:
- A full URL: `https://linear.app/tipfy/issue/TIP-96/analytics-inline-em-cada-card-da-listagem`
- A shorthand: `#TIP-96` or `tipfy/issue/TIP-96`
- A phrase like "implement issue TIP-96"


### 2. Fetch the issue

Use linear MCP to fetch the issue details, including title, description, and any existing tasks (checkboxes) in the description. If the issue is not found, inform the user and ask for clarification.


### 3. Create a branch

Create a branch from the main branch with a descriptive name derived from the issue:

```bash
git checkout main && git pull
git checkout -b feature/issue-<number>
```

The slug should be lowercase, hyphenated, max ~50 chars (e.g., `feature/issue-54`). If the user is already on a branch that looks issue-related (e.g., starts with `feature/issue-<number>`), ask whether to reuse it instead of creating a new one.

### 4. Plan the implementation

Before writing code, enter Plan mode to design the approach. The plan should:
- List each open task from the issue
- For each task, outline the files to change, the approach, and any risks
- Identify dependencies between tasks (task B may depend on task A)
- Consider the project's architecture and conventions (read CLAUDE.md if present)
- Load /impeccable craft skills to critique the plan for potential design/UX issues or improvements

Present the plan to the user and wait for approval before proceeding. This is important because the user may want to adjust scope, reorder tasks, or skip certain items.

### 5. Implement

1. Create a tracking task via TaskCreate with a clear subject
2. Mark it as `in_progress` when starting
3. Do the implementation work
4. Run the project's lint/check/test commands to verify correctness
5. Mark the tracking task as `completed`
6. Update the Linear issue checkbox from `- [ ]` to `- [x]` using:
7. After all tasks are done, run /impeccable critique skills to improve UI/UX

Tackle tasks in dependency order. If multiple tasks are independent, they can be done sequentially, no need to ask the user between each one unless something unexpected comes up.

### 7. Commit the work

After all tasks are implemented and verified, create a commit (or multiple if the changes are logically separable). Follow the repository's commit message conventions.

## Error handling

- If a task fails (tests break, lint errors), fix it before moving on — don't check off a broken task
- If implementation reveals that a task is blocked or out of scope, leave it unchecked and inform the user rather than silently skipping it
- If the issue body update fails (e.g., race condition with someone else editing), retry once, then warn the user