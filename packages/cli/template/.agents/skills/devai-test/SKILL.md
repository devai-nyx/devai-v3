---
name: devai-test
description: Derive the acceptance tests of an approved DEVAI spec before the implementation exists. Use for kind: test packets.
---
# devai-test

Derive from the spec only. Never open the module's `src/` or seed files (unit
specs included); generated code never supplies an expected value.

## The file
`domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts`: exactly one
top-level `it('R-n: <name>', …)` per `acceptance: "yes"` requirement.
Build inputs and assertions from each `observable`; each `falsifier` must fail
its case. Get the database through the `@stynx-nyx/testing` helpers; never
start Docker or testcontainers. Observe isolation as `<product>_app`, never owner.

## Expected red
`observations.unimplemented` names the cases that must fail now; all others pass.
- A named case carries no rail assertion (401/403, isolation, DTO validation).
- It must fail at an `expect` about the missing behaviour: seed its data with SQL,
  not through routes not built yet.
- A frozen `R-n` mixing rail and business assertions is a spec defect: note it
  under `## Notes` and stop; never drop an assertion.

## Re-deriving when the implementation exists
```sh
git worktree add --no-checkout -b <branch> ../<m>-tests <base> && cd ../<m>-tests
{ printf '/*\n!/domain/<m>/api/src/\n!/domain/<m>/web/src/\n'
  git show <base>:domain/<m>/generation-manifest.json | node -e 'for(const f of JSON.parse(require("fs").readFileSync(0)).files)if(f.mode==="seed")console.log("!/domain/<m>/"+f.path)'
} | git sparse-checkout set --no-cone --stdin
git checkout && test ! -e domain/<m>/api/src
# write and commit the tests, then:
git sparse-checkout disable && devai check --packet <packet>
```
A changed acceptance file needs `// @acceptance-change: approved-by=<pilot>`; the
pilot writes it.
