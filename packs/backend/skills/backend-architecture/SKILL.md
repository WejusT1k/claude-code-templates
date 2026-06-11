---
name: backend-architecture
description: Architectural conventions shared by all backend service repositories. Use when adding domains, use-cases, or persistence in any backend service so structure stays uniform across the 4 services.
---

# Backend service architecture (shared by all backend repos)

Use this when working in any of the org's backend services. All 4 services
follow the same layered shape.

## Layers

- `domain/` — entities, value objects, domain rules. No framework imports.
- `application/` — use-cases orchestrating domain + ports.
- `infrastructure/` — adapters: persistence, messaging, external APIs.
- `interfaces/` — transport (HTTP/gRPC/queue handlers) calling use-cases.

## Conventions

- Dependencies point inward (interfaces → application → domain).
- Side effects behind ports; infrastructure implements them.
- Each use-case is independently testable with fakes.

> Placeholder: fill in the concrete framework, DB, and messaging for your org.
> Edit in `claude-code-templates`, not in the consuming repo.
