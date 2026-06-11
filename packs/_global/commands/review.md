---
description: Review the current diff for correctness and consistency with org conventions.
---

Review the current working-tree diff (`git diff` + staged changes).

Focus, in priority order:

1. **Correctness** — logic bugs, unhandled errors, edge cases, race conditions.
2. **Consistency** — does it match the surrounding code and org conventions
   (naming, error handling, logging)?
3. **Tests** — is the change covered? Flag missing or weak tests.
4. **Simplicity** — call out dead code, needless abstraction, duplication.

Report findings grouped by severity (blocking / should-fix / nit). Quote
`file:line`. Do not rewrite the code unless asked — just report.
