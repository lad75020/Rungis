# Research: Refunds Overdue Bills and Reminders

## Retrospective implementation source of truth

**Decision**: Use the existing route modules, models, Angular components, and generated SDD docs as evidence for this Time Machine feature.

**Rationale**: The queue was produced from an existing codebase and the relevant behavior is already present in source files.

**Alternatives considered**: Rebuild the feature from scratch, which would risk regressions and duplicate existing behavior.

## Server-side role enforcement

**Decision**: Keep authorization in Fastify guards and action-level checks rather than relying on Angular UI hiding.

**Rationale**: Role boundaries are security-critical and the existing backend already centralizes these checks.

**Alternatives considered**: Frontend-only authorization, which would expose data and mutation risks.

## Validation and scoped realtime updates

**Decision**: Validate identifiers, numeric bounds, dates, and payload shape before writes or broadcasts.

**Rationale**: The implementation handles business data that affects orders, bills, stock, or account relationships.

**Alternatives considered**: Accept broad payloads and rely on database failures, which would produce weaker errors and higher security risk.

## Verification scope

**Decision**: Use production Angular build, frontend unit tests, source inspection, and generated task evidence for this retrospective pass.

**Rationale**: The current repo has working frontend test/build scripts and the implementation is already represented in source.

**Alternatives considered**: Inventing unrun functional results, which is not acceptable for Time Machine evidence.
