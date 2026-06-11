---
name: spa-architecture
description: Architectural conventions shared by all SPA (single-page app) repositories. Use when adding features, components, or state to any SPA repo so structure stays uniform across the 4 SPAs.
---

# SPA architecture (shared by all SPA repos)

Use this when working in any of the org's single-page applications. All 4 SPAs
follow the same shape — keep new code aligned with it.

## Layout

- `src/features/<feature>/` — feature-sliced; each owns its components, hooks, and state.
- `src/shared/` — cross-feature UI primitives, utils, and API clients.
- `src/app/` — routing, providers, and app-level composition.

## Conventions

- Data fetching goes through the shared API client; no raw `fetch` in components.
- Server state via the shared query layer; local UI state stays in the component.
- Components are presentational where possible; side effects live in hooks.

> Placeholder: fill in the concrete stack (router, state lib, styling) for your org.
> Edit in `claude-code-templates`, not in the consuming repo.
