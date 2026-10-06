---
name: grill-me
description: A relentless interview to sharpen a plan or design.
disable-model-invocation: true
---

Run a `/grilling` session.

**FinCraft mandatory topics** — cover these for any architecture, API, or feature scope (see `docs/ARCHITECTURE_CODING_STANDARDS.md`):

1. **Layer placement** — what belongs in Go `domain` vs `service` vs `handler` vs React?
2. **Financial correctness** — rounding, debit/credit, duplicates, period boundaries, reconciliation
3. **API contract** — request/response shapes, error codes, idempotency on reprocess
4. **Deterministic vs AI** — which steps are pure Go vs AI interpretation?
5. **Test scenarios** — list all unit-test cases before any code is written
6. **YAGNI / SOLID** — challenge any proposed interface, package, or abstraction: is there a second use case?

Do not propose code until the frontier is empty and the user confirms shared understanding.
