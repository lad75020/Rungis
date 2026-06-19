# Implementation Plan: Localization and Presentation

**Branch**: `feature/time-machine-localization-presentation` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-localization-presentation/spec.md`

## Summary

Document and verify bilingual English/French text handling, style-profile selection, shared Angular shells, CSS bundles, and generated frontend asset serving.

## Technical Context

**Language/Version**: JavaScript ES modules on Node.js; TypeScript with Angular 21

**Primary Dependencies**: Fastify route modules, Mongoose models, Redis-backed operational state where applicable, Angular standalone page components, Bootstrap styling, websocket and REST clients

**Storage**: MongoDB for persistent business entities; Redis for sessions, carts, rate/reminder state, and realtime operational data; SQLite for local app settings where applicable

**Testing**: Angular production build and Angular/Vitest frontend tests; Playwright and backend checks are documented where relevant

**Target Platform**: Browser-based B2B web portal

**Project Type**: Full-stack web application

**Performance Goals**: Interactive user operations should complete within normal web expectations, with realtime updates visible without manual refresh during connected sessions

**Constraints**: Role guards must enforce admin, vendor, and client boundaries on the server; generated artifacts are retrospective and must not expand the feature beyond the queued files

**Scale/Scope**: One Time Machine slice focused on Localization and Presentation

## Constitution Check

The constitution is template-only. Default gates all PASS: server-side authorization, validation before writes, safe payload handling, testability, generated artifact completeness, and scope control.

## Project Structure

```text
specs/010-localization-presentation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/localization-presentation.md
└── tasks.md

backend/src/i18n/translations.json
backend/src/lib/translations.js
backend/src/lib/angular-assets.js
backend/src/routes/modules/pages.js
frontend/src/app/app.constants.ts
frontend/src/app/app.config.ts
frontend/src/app/app.css
frontend/src/styles.css
frontend/src/styles-primary.css
frontend/src/styles-secondary.css
frontend/angular.json
```

## Design Summary

- [research.md](./research.md) records scope, security, and verification decisions.
- [data-model.md](./data-model.md) defines the feature entities and lifecycle constraints.
- [contracts/localization-presentation.md](./contracts/localization-presentation.md) documents the relevant external surface.
- [quickstart.md](./quickstart.md) lists verification commands.

## Post-Design Constitution Check

PASS — generated artifacts preserve role-scoped access, validation before persistence, and the Time Machine feature boundary.
