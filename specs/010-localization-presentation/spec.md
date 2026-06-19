# Feature Specification: Localization and Presentation

**Feature Branch**: `feature/time-machine-localization-presentation`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Localization and Presentation. Description: The application provides English/French translations, theme controls, style profiles, shared Angular shells, and generated frontend assets. Relevant files: backend/src/i18n/translations.json, backend/src/lib/translations.js, backend/src/lib/angular-assets.js, backend/src/routes/modules/pages.js, frontend/src/app/app.constants.ts, frontend/src/app/app.config.ts, frontend/src/app/app.css, frontend/src/styles.css, frontend/src/styles-primary.css, frontend/src/styles-secondary.css, frontend/angular.json. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render localized UI text (Priority: P1)

As a user, I want the portal to show English or French text consistently so I can use it in my preferred language.

**Why this priority**: Localization affects every page and error-prone text path.

**Independent Test**: Load pages with each supported language and verify known labels and PDF labels use translated text.

**Acceptance Scenarios**:

1. **Given the English language is selected**, **When** a page loads, **Then** English labels are shown.
2. **Given the French language is selected**, **When** a page loads, **Then** French labels are shown.

---

### User Story 2 - Switch presentation style profile (Priority: P2)

As an administrator, I want to choose a primary or secondary style profile so the portal can use the preferred presentation theme.

**Why this priority**: Style profile selection is a visible operational setting.

**Independent Test**: Update the style profile as admin and verify the next page bootstrap includes the selected bundle.

**Acceptance Scenarios**:

1. **Given the admin selects a supported profile**, **When** it is saved, **Then** future page loads use that profile.
2. **Given an unsupported profile is submitted**, **When** save is attempted, **Then** the system rejects it.

---

### User Story 3 - Serve Angular assets through shared shells (Priority: P3)

As a user, I want every role page to load the Angular application and generated assets reliably so the interactive UI starts from the server-rendered shell.

**Why this priority**: Asset serving and shells bind backend access control to the frontend app.

**Independent Test**: Build the frontend and load representative page shells to verify Angular asset references are present.

**Acceptance Scenarios**:

1. **Given the frontend build exists**, **When** a shell page renders, **Then** it references the generated Angular scripts and styles.
2. **Given the page requires a role**, **When** an unauthorized user requests it, **Then** the backend redirects or rejects before Angular starts.

---

### Edge Cases

- Unsupported language codes must fall back safely.
- Missing translation keys must use defined fallback text.
- Unsupported style profiles must be rejected.
- Generated Angular asset manifests must reflect current output names.
- Role-protected shells must enforce access before client rendering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support English and French translation dictionaries.
- **FR-002**: The system MUST select request language from supported language inputs and safe defaults.
- **FR-003**: The system MUST expose translated labels to backend-rendered shells and PDF generation.
- **FR-004**: The system MUST store and return a global primary or secondary app style profile.
- **FR-005**: The system MUST include primary and secondary CSS bundles in the frontend build configuration.
- **FR-006**: The system MUST serve generated Angular assets from the backend static directory.
- **FR-007**: The system MUST keep shared page shells consistent across role-specific pages.

### Key Entities *(include if feature involves data)*

- **Translation Catalog**: A keyed set of English and French display strings.
- **Language Selection**: The supported language value used for request rendering.
- **Style Profile**: The primary or secondary presentation mode selected by admins.
- **Angular Asset Manifest**: Generated files served by the backend shell.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Supported pages render without unresolved translation keys in normal operation.
- **SC-002**: Admin style profile changes are visible on the next page load.
- **SC-003**: Production frontend build completes and emits assets to the backend public directory.
- **SC-004**: Unsupported language or style values do not crash page rendering.

## Assumptions

- English and French are the supported languages for this release.
- Theme profiles are global rather than per-user.
- Angular build output is served by Fastify from backend/src/public/angular.
