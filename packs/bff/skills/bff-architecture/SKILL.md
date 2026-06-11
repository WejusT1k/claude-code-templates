---
name: bff-architecture
description: Architectural conventions shared by all BFF (backend-for-frontend) repositories. Use when adding routes, aggregating services, or shaping responses in any BFF repo so structure stays uniform across the 4 BFFs.
---

# BFF architecture (shared by all BFF repos)

Use this when working in any of the org's backend-for-frontend services. All 4
BFFs follow the same shape.

## Responsibilities

- Aggregate and reshape data from backend services for a specific frontend.
- Own no business rules — orchestrate, don't decide.
- Handle auth/session at the edge; pass identity downstream.

## Layout

- `src/routes/` — one module per frontend-facing endpoint.
- `src/clients/` — typed clients for downstream backend services.
- `src/mappers/` — response shaping (backend models → frontend view models).

## Conventions

- Every downstream call has a timeout + fallback.
- Responses are versioned and typed; never leak raw backend payloads.

> Placeholder: fill in the concrete framework and client setup for your org.
> Edit in `claude-code-templates`, not in the consuming repo.
