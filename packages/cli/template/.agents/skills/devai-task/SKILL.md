---
name: devai-task
description: Work one DEVAI task packet (packets/**/PKT-*.md) through the check loop to acceptance.
---
# devai-task

Read the packet; the whole pinned spec, `git show <base>:<spec.path>` (kind `spec`:
`spec.path` is your output; kind `standards`: no spec); each `context` range at
`base`; `domain/<m>/README.md` if present. Nothing else is required.

## Loop
1. `devai check --packet <packet>`: the edit-loop nodes plus packet scope and the
   packet's acceptance tests. Fix the findings top-down; re-run.
2. A path you need outside `paths.allowed`: add it there and continue (`forbidden`
   still wins). Nobody is asked; the PR shows the edit.
3. Commit with trailers `Packet: <id>` and your `Co-Authored-By:` line; the reviewer
   is chosen from it.
4. `devai check --packet <packet> --full`. Exit 0 accepts. Then commit the files it
   wrote under `.devai/review/` as they are.

## Stop
At exit 0 on `--full`. Or when the spec or an acceptance test is wrong, or a choice
needs the pilot: write it under `## Notes` and leave the packet unaccepted. Outside a
`test` packet never edit `api/test/acceptance/**`, and never `observations`.
Reviewer findings: the `devai-review` skill.
