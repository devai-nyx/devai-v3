# Recorded model-CLI streams

Recorded 2026-10-24 on the R6 W5 host (macOS) from the installed, authenticated CLIs: `claude` 2.1.292
(Claude Code) and `codex-cli` 0.163.0. Scratch paths are replaced by `/tmp/devai-rec` and the
worktree path by `/repo`; nothing else is edited. No credentials appear in any stream.

| File | Command (prompt on stdin) | What it shows |
|---|---|---|
| `claude-sensor.jsonl` | `claude -p --output-format stream-json --verbose --json-schema <schema> --model haiku --no-session-persistence --setting-sources "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --tools "" --restricted` | init `tools: ["StructuredOutput"]`; the answer as a `StructuredOutput` tool_use and `result.structured_output`; usage split into input / cache creation / cache read |
| `claude-bare-unauthenticated.jsonl` | the same plus `--bare` (B.24's list) | `--bare` reads no OAuth: assistant `error: authentication_failed`, `result.is_error: true`, "Not logged in · Please run /login" |
| `claude-phase2-n19.jsonl` | B.27 phase 2 flags (`--restricted --tools Read,Grep,Glob,Bash --allowedTools … --disallowedTools … --settings '{"sandbox":…}'`) plus `Bash(ls:*)`, cwd = a scratch dir, asked to write into the real worktree and to fetch a host | `Bash` tool items; the write is `EPERM` and the fetch fails inside the sandbox; the answer reports neither succeeded |
| `claude-reject.err` | `claude -p … --sandbox-nope x` | stderr of a rejected flag (exit 1, no stdout) |
| `codex-sensor.jsonl` | `codex exec --json --output-schema <file> --ephemeral --ignore-user-config --ignore-rules --skip-git-repo-check --cd <empty> --sandbox read-only -` | `agent_message` then `turn.completed` with usage; no model id in the stream |
| `codex-phase2.jsonl` | `codex exec … --cd <scratch> --sandbox workspace-write -`, asked to run `ls`, write a file outside `--cd` (under /tmp) and `curl` a host | `command_execution` items with `aggregated_output`; the /tmp write succeeded (default writable root), the network call failed |
| `codex-schema-rejected.jsonl` | `codex exec … --output-schema <ReviewModelOutput as zod emits it>` | OpenAI strict mode rejects an optional property: `error` and `turn.failed` (exit 1) |
| `codex-nullable-answer.jsonl` | the same with the strict transform of `src/model/cli.ts` | the optional `counterexample` answered as `null` |
| `codex-reject.err` | `codex exec --json --sandbox-nope -` | stderr of a rejected flag (exit 2, no stdout) |
