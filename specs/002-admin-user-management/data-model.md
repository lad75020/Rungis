# Data Model: Admin User Management

## Pending User

Inactive vendor or client account awaiting administrative approval.

### Fields

- `id`: account identifier.
- `role`: vendor or client.
- `username`, `firstName`, `lastName`, `organisation`, `city`, `zipcode`, `email`, `physicalAddress`, `phoneNumber`: identity and contact summary.
- `businessRegistrationId`: 14-digit business identifier.
- `isActive`: false while pending.
- `createdAt`: queue ordering timestamp.

### State Transitions

1. Signup creates inactive account.
2. Admin activates account → `isActive` becomes true and account leaves queue.
3. Admin deletes pending account → record is removed if still inactive.

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
