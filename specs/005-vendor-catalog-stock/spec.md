# Feature Specification: Vendor Catalog and Stock

**Feature Branch**: `feature/time-machine-vendor-catalog-stock`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Vendor Catalog and Stock. Description: Vendors manage merchandise, prices, stock levels, minimum thresholds, categories, and item images shown to clients. Relevant files: backend/src/models/merchandise.model.js, backend/src/routes/modules/websocket.js, backend/src/routes/modules/auth.js, backend/src/lib/angular-assets.js, frontend/src/app/pages/stocks-page.component.ts, frontend/src/app/pages/stocks-page.component.html, frontend/src/app/app.ts, frontend/src/app/app.types.ts. Focus on this feature only; do not modify other features."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain merchandise records (Priority: P1)

As a vendor, I want to create and edit merchandise with price, stock, reference, category, and threshold data so my catalog is accurate.

**Why this priority**: Clients cannot order reliably unless vendor catalog data is current.

**Independent Test**: Use the stock page to create, edit, and list merchandise for the logged-in vendor.

**Acceptance Scenarios**:

1. **Given a vendor is connected to the stock page**, **When** the vendor creates valid merchandise, **Then** it appears in the vendor stock list.
2. **Given a vendor updates price or stock**, **When** the save succeeds, **Then** the updated values are persisted.

---

### User Story 2 - Remove unavailable merchandise (Priority: P2)

As a vendor, I want to delete obsolete merchandise so clients no longer see unavailable items.

**Why this priority**: Catalog cleanup prevents stale items from being ordered.

**Independent Test**: Delete an item and verify it is no longer visible to assigned clients.

**Acceptance Scenarios**:

1. **Given merchandise belongs to the vendor**, **When** it is deleted, **Then** it disappears from the stock list and client catalog.
2. **Given another vendor owns an item**, **When** delete is attempted, **Then** the request is rejected.

---

### User Story 3 - Attach product images and stock alerts (Priority: P3)

As a vendor, I want item images and minimum-stock thresholds so clients recognize products and I can see low-stock risk.

**Why this priority**: Presentation and threshold data improve operational quality but are not required for basic CRUD.

**Independent Test**: Upload a supported image and set a threshold, then verify the stock UI shows the saved data.

**Acceptance Scenarios**:

1. **Given a supported image is uploaded**, **When** the item is saved with the image filename, **Then** the catalog can display it.
2. **Given stock is at or below the minimum**, **When** the list renders, **Then** the item can be identified as low stock.

---

### Edge Cases

- Price and stock values must reject negative or non-numeric input.
- Merchandise uniqueness must prevent duplicate category, name, reference, and vendor combinations.
- Only the owning vendor may update or delete an item.
- Deleted or zero-stock items must be removed or marked unavailable in client order catalogs.
- Unsupported image mime types must be rejected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let vendors list their own merchandise.
- **FR-002**: The system MUST let vendors create merchandise with name, reference, category, price, stock, minimum stock, and optional image data.
- **FR-003**: The system MUST let vendors update owned merchandise fields.
- **FR-004**: The system MUST let vendors delete owned merchandise.
- **FR-005**: The system MUST validate non-negative stock and price values.
- **FR-006**: The system MUST support item image upload using allowed image types.
- **FR-007**: The system MUST broadcast catalog and stock changes to relevant stock and order pages.

### Key Entities *(include if feature involves data)*

- **Merchandise**: A vendor-owned catalog item with price, stock, reference, category, image, and threshold fields.
- **Stock Snapshot**: A realtime representation of current vendor inventory.
- **Catalog Item**: A client-visible projection of assigned-vendor merchandise.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Vendors can create or update a merchandise item in under 45 seconds during normal operation.
- **SC-002**: Assigned clients see catalog updates without a full page reload after realtime propagation.
- **SC-003**: Invalid price, stock, or image inputs are rejected before persistence.
- **SC-004**: Non-owner update and delete attempts are rejected.

## Assumptions

- Vendor authentication and relationship assignment already exist.
- Image files are stored by existing upload handling under backend public uploads.
- Currency is EUR throughout catalog and order flows.
