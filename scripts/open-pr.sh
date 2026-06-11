#!/usr/bin/env bash
# Commit any working-tree changes in a target checkout onto a fixed branch and
# open (or update) a pull request. Replaces peter-evans/create-pull-request with
# plain git + the GitHub CLI (gh) so we depend on no third-party action.
#
# Idempotent:
#   - no changes        -> does nothing, no PR
#   - branch is rebuilt  -> single commit on top of base, force-pushed
#   - PR already open    -> branch is updated, no duplicate PR
#
# Requires: git, gh, and GH_TOKEN in the environment (scoped to the target repo).
#
# Usage:
#   scripts/open-pr.sh --target-dir <dir> --base <branch> --branch <branch> \
#                      --title <title> --sha <source-sha> --body-file <path>

set -euo pipefail

target_dir="" base="" branch="" title="" sha="" body_file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --target-dir) target_dir=$2; shift 2 ;;
    --base)       base=$2;       shift 2 ;;
    --branch)     branch=$2;     shift 2 ;;
    --title)      title=$2;      shift 2 ;;
    --sha)        sha=$2;        shift 2 ;;
    --body-file)  body_file=$2;  shift 2 ;;
    *) echo "open-pr: unknown argument: $1" >&2; exit 2 ;;
  esac
done

for v in target_dir base branch title sha body_file; do
  if [ -z "${!v}" ]; then echo "open-pr: --${v//_/-} is required" >&2; exit 2; fi
done
if [ -z "${GH_TOKEN:-}" ]; then echo "open-pr: GH_TOKEN must be set" >&2; exit 2; fi

# Resolve body file to an absolute path before we cd into the target.
body_file=$(cd "$(dirname "$body_file")" && printf '%s/%s' "$(pwd)" "$(basename "$body_file")")

cd "$target_dir"

git config user.name "claude-templates[bot]"
git config user.email "claude-templates[bot]@users.noreply.github.com"

# Build the branch at the current base tip, then stage everything sync wrote.
git checkout -B "$branch"
git add -A

if git diff --cached --quiet; then
  echo "open-pr: no changes — nothing to sync for this repo."
  exit 0
fi

git commit -m "$title (${sha})"
git push --force origin "$branch"

# Create the PR only if one isn't already open for this head branch.
existing=$(gh pr list --head "$branch" --base "$base" --state open --json number --jq '.[0].number' || true)
if [ -n "$existing" ]; then
  echo "open-pr: PR #$existing already open for '$branch' — branch updated."
else
  gh pr create --base "$base" --head "$branch" --title "$title" --body-file "$body_file"
  echo "open-pr: opened a new PR for '$branch'."
fi
