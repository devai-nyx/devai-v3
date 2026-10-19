---
name: devai-review
description: Act on DEVAI reviewer findings in .devai/review/<packet-id>.json after devai check --full; write review dispositions in the packet.
---
# devai-review

`--full` ran a reviewer of the other model family. Each finding in
`.devai/review/<id>.json` has a `fingerprint`, a requirement, a locator, a statement
and often a counterexample. It is a claim: check it, running its counterexample
when it has one, before acting.

- Real: fix it and re-run `--full`.
- Wrong: under `## Review dispositions` in the packet add
  `RV <first 12+ hex of fingerprint> · <R-n> · <locator> · not-a-defect · <reason>`,
  the prefix extended until unique, R-n and locator copied from the finding, the
  reason citing the spec's observable or source. The next `--full` re-checks it.
- `accepted-risk` is the pilot's word. A finding that needs a business decision goes
  under `## Notes` for the pilot; it means a successor spec, not a disposition.

A disposition never silences a deterministic node. Re-run `--full` after a change,
or once for `model-error`/`timeout`; never to reroll a verdict. Never run the
reviewer CLI yourself. Any commit except one adding `.devai/review/` makes the
review stale.
