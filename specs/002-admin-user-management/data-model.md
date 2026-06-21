# Data Model: Admin User Management

## Admin Managed User

Administrator-visible representation of an account that can be created, searched, loaded, and updated from the admin page.

### Fields

- `id`: account identifier.
- `role`: `vendor`, `client`, or `admin`.
- `username`: unique sign-in name, normalized to lowercase.
- `uniqueId`: application-generated 5-digit operational identifier, never accepted from admin create/update forms.
- `firstName`, `lastName`, `organisation`, `city`, `zipcode`, `email`, `physicalAddress`, `phoneNumber`: identity and contact fields.
- `businessRegistrationId`: mandatory 14-digit SIRET-style business identifier.
- `businessDescription`, `vatId`, `billMentions`, `logoFilename`, `logoUrl`: optional business profile fields.
- `isActive`: whether the user can sign in.
- `createdAt`, `updatedAt`: audit timestamps.

### Excluded Fields

API responses must not include passwords, password hashes, passkeys, session data, client/vendor association arrays, or raw MongoDB internals.

## Admin User Create Form

Payload submitted by an administrator to create a user.

### Required Fields

- `role`
- `username`
- `firstName`
- `lastName`
- `organisation`
- `city`
- `zipcode`
- `email`
- `physicalAddress`
- `phoneNumber`
- `businessRegistrationId`
- `password`

### Optional Fields

- `businessDescription`
- `vatId`
- `billMentions`
- `logoFilename`

### Validation Rules

- `role` must be one of `vendor`, `client`, or `admin`.
- `username` and `email` must be unique.
- The backend generates `uniqueId` as exactly 5 digits and relies on MongoDB's unique index as the final uniqueness guarantee.
- Submitted `uniqueId` values are rejected as protected fields.
- `businessRegistrationId` must contain exactly 14 digits.
- `vatId`, when present, must contain exactly 13 characters.
- `password` is required and must contain at least 8 characters.
- Dangerous object keys and protected fields are rejected.
- Created users are persisted with `isActive: false` regardless of payload content.
- The backend hashes `password` and never returns it or the resulting hash.

## Admin User Update Form

Payload submitted by an administrator to edit an existing user.

### Required Fields

Same profile fields as the create form, plus `isActive` as a boolean.

### Optional Fields

Same optional profile fields as the create form. `password` is optional and only replaces the existing password when non-empty.

### Validation Rules

- Object id must be valid and match an existing user.
- Duplicate checks exclude the current user.
- `isActive` must be a boolean and is the only supported activation-state control.
- Dangerous object keys and protected fields are rejected.
- Password replacement is hashed when provided; blank password leaves the existing password hash unchanged.
- Responses use the safe `AdminManagedUser` representation.

## Admin Setting

Named operational configuration value.

### Fields

- `key`: setting identifier, such as bill-overdue-days or app-style-profile.
- `value`: validated setting value.

### Validation Rules

- Overdue days must be an integer from 1 to 3650.
- Style profile must be a supported profile name.

## Billing Run Request

Administrator request to run daily bill generation for a specific day.

### Fields

- `day`: ISO calendar date.

### Validation Rules

- Day must parse as a valid YYYY-MM-DD date.
