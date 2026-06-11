# claude-code-templates

Central source of truth for reusable **Claude Code** assets — skills, agents,
slash commands, and prompts — shared across the org's repositories.

When something merges to `main` here, a GitHub Action opens (or updates) a pull
request in **every dependent repo** with the refreshed assets. Claude Code reads
skills/agents/commands from a repo's local `.claude/` directory, so assets are
physically **copied** into each repo rather than read live.

## How it works

```
        edit a skill/agent/command/prompt
                     │
              merge to main ───────────► CI: validate.mjs (registry + packs)
                     │
            .github/workflows/fan-out.yml
                     │  for each target in registry.json (in parallel)
                     ▼
   mint GitHub App token → checkout target → scripts/sync.mjs → open/update PR
                     │
                     ▼
   target repo gets a `chore/claude-templates-sync` PR (only if something changed)
```

- The sync is **idempotent**: it runs against a stable branch, so re-runs update
  the same PR. If nothing changed for a repo, **no PR is created**.
- A per-target **lockfile** (`.claude/.templates-lock.json`) records exactly which
  files we manage, so:
  - removing an asset here removes it from every repo on the next sync;
  - a hand-written file in a target that collides with a managed path makes the
    sync **abort loudly** rather than clobber it.

## Repo layout

```
packs/
  _global/   skills/ agents/ commands/ prompts/   # shared by ALL repos
  spa/       skills/ agents/ commands/ prompts/   # only the SPA repos
  bff/       skills/ agents/ commands/ prompts/   # only the BFF repos
  backend/   skills/ agents/ commands/ prompts/   # only the backend services
registry.json          # which repos get which packs
scripts/
  sync.mjs             # the sync engine (run per target)
  validate.mjs         # CI validation
  lib/                 # registry / files / lock helpers (no deps)
.github/workflows/
  fan-out.yml          # push to main -> PR in every dependent repo
  ci.yml               # validate on PRs into main
```

### Asset → target path mapping

| In a pack                          | Lands in the target repo as          |
|------------------------------------|--------------------------------------|
| `<pack>/skills/foo/SKILL.md`       | `.claude/skills/foo/SKILL.md`        |
| `<pack>/agents/bar.md`             | `.claude/agents/bar.md`              |
| `<pack>/commands/baz.md`           | `.claude/commands/baz.md`            |
| `<pack>/prompts/*`                 | `.claude/prompts/*`                  |

> **Note on `prompts/`:** Claude Code has no native discovery for a `prompts/`
> directory. Reusable *slash-command* prompts belong in `commands/` (they become
> `/command` entries). `prompts/` is copied as plain reference docs for humans.

## Common tasks

### Add or edit a shared skill / command / agent

1. Put the file under the right pack and kind, e.g.
   `packs/_global/skills/<name>/SKILL.md` or `packs/spa/commands/<name>.md`.
2. Skills and agents need YAML frontmatter with `name` and `description`.
3. Open a PR. CI validates it. On merge to `main`, dependent repos get sync PRs.

Do **not** hand-edit synced files in the consuming repos — they carry a
`managed by claude-code-templates` marker and will be overwritten. Edit here.

### Register a new repository

Add an entry to [`registry.json`](registry.json):

```json
{ "repo": "ORG/new-spa", "packs": ["_global", "spa"] }
```

Optionally pin a non-default base branch with `"branch": "develop"`.

### Run the sync locally (dry-run or real)

```bash
# preview what a repo would receive
node scripts/sync.mjs --repo ORG/spa-1 --target-dir ../spa-1 --dry-run

# actually write into a checkout (then review/commit there)
node scripts/sync.mjs --repo ORG/spa-1 --target-dir ../spa-1

# validate everything (registry + packs + all dry-runs)
npm run validate
```

## One-time setup: GitHub App

Cross-repo PRs are authored by a dedicated **GitHub App** (no long-lived PATs).

1. Create an organization GitHub App with these repository permissions:
   - **Contents:** Read & write
   - **Pull requests:** Read & write
2. Install it on this repo **and** all target repos in `registry.json`.
3. In this repo's settings add:
   - Variable `CLAUDE_TEMPLATES_APP_ID` = the App's ID
   - Secret `CLAUDE_TEMPLATES_APP_PRIVATE_KEY` = the App's private key (`.pem`)

`fan-out.yml` mints a short-lived installation token scoped to each target repo
at run time via `actions/create-github-app-token`.

## Notes

- The sync engine is pure Node (≥ 18), no dependencies — it runs anywhere.
- To reduce fan-out volume later, the matrix can be filtered to only targets
  whose packs changed in the push; today it fans out to all and relies on the
  "no diff = no PR" behavior to stay quiet.
