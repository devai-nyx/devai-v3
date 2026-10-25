# @devai-nyx/cli

The `devai` command of DEVAI v3. It scaffolds a product repository from the template, runs the
check DAG over a candidate change and reports `PASS` / `FAIL` / `UNKNOWN` per node, and renders
modules from approved specs. Every input is a flag; nothing is interactive.

Documentation: <https://devai-nyx.github.io/devai-v3/>.

## Install

The package is on GitHub Packages, which needs a token even for public packages. The repository's
`.npmrc` maps the scopes and reads the token from `NODE_AUTH_TOKEN`:

```ini
@devai-nyx:registry=https://npm.pkg.github.com
@stynx-nyx:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

In a repository that `init` created, install or pin the CLI as an exact root dev dependency:

```sh
pnpm add -w -D --save-exact @devai-nyx/cli@3.0.0 && pnpm install
```

The version must be exact: `generated` compares the installed CLI with the `generatorVersion` each
module recorded. Node `>=24 <25` and pnpm 9.15.0 through Corepack.

## Entry points

| Command | What it does |
|---|---|
| `devai init --product <slug> [--dir <path>]` | In an empty folder, write the template, install, and make the two `init` commits; in a clone with `devai.json`, attach the hooks and agent identity |
| `devai check [--packet <file>] [--full]` | Run the check DAG; exit `0` clean, `1` a `FAIL`, `2` an `UNKNOWN` |
| `devai new module --spec <file>` | Generate one module from one approved spec |
| `devai packet new\|lint\|rebase`, `devai packets status` | Author task packets and read their state from git |

The first scaffold runs from the registry before any project `.npmrc` exists:

```sh
pnpm dlx @devai-nyx/cli@3.0.0 init --product <slug> --dir <empty-dir>
```

See [Install](https://devai-nyx.github.io/devai-v3/docs/adopters/install) for the user-level
registry config that step needs, the [Quickstart](https://devai-nyx.github.io/devai-v3/docs/start/quickstart)
for a first campaign, and the [CLI reference](https://devai-nyx.github.io/devai-v3/docs/reference/cli)
for every flag and exit code.

`./eslint-overlay` is exported for the template's ESLint config.

License: Apache-2.0.
