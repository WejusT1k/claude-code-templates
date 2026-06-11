---
name: commit-style
description: Shared commit message conventions for all repositories. Use when writing git commit messages or preparing a PR so style stays consistent across the org.
---

# Commit style (org-wide)

Apply this whenever you author a git commit or describe changes for a PR.

## Format

```
<type>(<scope>): <short imperative summary>

<optional body — what & why, not how>
```

- **type**: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `build`, `ci`.
- **scope**: the area touched (module, package, route). Optional but encouraged.
- **summary**: imperative mood, lower-case, no trailing period, ≤ 72 chars.

## Rules

- One logical change per commit.
- Body explains intent and trade-offs, references issues (`Refs #123`).
- Breaking changes: add a `BREAKING CHANGE:` footer.

This skill is shared across every repo via `claude-code-templates`. Edit it there, not here.


