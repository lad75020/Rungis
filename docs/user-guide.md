# User Guide

## Features

### Account Sign-Up and Login

Rungis supports vendor and client sign-up through the subscription page. New vendor and client accounts are inactive until an admin approves them. Existing users can log in with username and password. Users can also register and use passkeys when their browser supports WebAuthn.

What it does: Creates accounts, authenticates users, and manages active sessions.

When to use it: Use sign-up for new vendor/client onboarding and login for daily access.

### Admin Console

Admins approve pending users, delete pending accounts, manage vendor-client associations, set overdue-bill thresholds, switch the active global style profile, trigger daily bill generation for a chosen day, and view activated order statistics.

What it does: Controls account activation, relationships, billing operations, settings, and admin reporting.

When to use it: Use the admin console to onboard users, maintain relationships, and operate global settings.

### Vendor Stock and Catalog Management

Vendors maintain merchandise records with name, reference, category, price, stock, image, and optional minimum stock threshold. Catalog changes can update connected ordering pages in realtime.

What it does: Lets vendors manage the products clients can order.

When to use it: Use the stocks page whenever merchandise, prices, images, or quantities change.

### Client Ordering

Clients browse merchandise from assigned vendors only. They can filter catalog items, manage favorites, choose a delivery date, add items to a cart, update quantities, remove items, group cart totals, and validate the cart into a persisted order.

What it does: Turns client cart selections into validated orders and consumes stock.

When to use it: Use the order page to prepare and submit daily vendor orders.

### Dashboards and Bills

Vendor and client dashboards show bill summaries and bill details. Vendors see bills by date or by client/date range. Clients see bills by date and unpaid bills by vendor. Both sides can export PDFs and track settlement state independently.

What it does: Provides operational visibility into orders, bills, settlements, comments, and PDFs.

When to use it: Use the dashboard to review, settle, comment on, or export bills.

### Bill Comments and Vendor Messages

Clients can attach a comment to a bill. Vendors see those comments as dashboard messages and in bill details. Vendors can mark messages as read or dismiss them from the dashboard list without deleting the bill comment.

What it does: Gives clients a bill-specific communication channel to vendors.

When to use it: Use comments to send delivery, billing, or clarification notes about a specific bill.

### Refunds, Penalties, Overdue Bills, and Reminders

Vendors can create refunds for clients. Refunds are queued and then added as negative lines during daily bill generation. Vendors can review overdue unsettled bills, add late-payment penalty lines, and send unpaid-payment reminders to clients. Clients see those reminders on their dashboard.

What it does: Handles post-order financial adjustments and overdue payment follow-up.

When to use it: Use refunds for client credits, penalties for overdue bills, and reminders for unpaid client balances.

### Statistics and Monthly Summaries

Admins can view activated order statistics. Vendors can view sales by category, sales by client, and monthly summaries by client.

What it does: Provides operational reporting for sales and ordering activity.

When to use it: Use reporting pages to review performance and activity over selected date ranges.

### Account and Passkey Management

Users can update their account profile, logo, business description, and passkeys. Vendors and clients can manage their own organization information.

What it does: Keeps contact and identity information current.

When to use it: Use the account page after profile changes or to add/remove passkeys.

### Style Profile Switching

Admins can switch the application between primary and secondary global style profiles. The selected profile is applied to future page loads.

What it does: Changes the global visual CSS profile served by the backend.

When to use it: Use this when testing or rolling out an alternate visual style.

## Usage Instructions

### Sign Up as Vendor or Client

Prerequisites: You are not currently logged in.

1. Open `/subscribe`.
2. Choose the vendor or client role.
3. Enter username, organization, first name, last name, city, zipcode, email, address, phone, business registration id, and password.
4. Submit the form.
5. Wait for an admin to activate the account.

Expected result: The account is created as inactive and becomes usable after admin approval.

### Log In

Prerequisites: Your account exists and is active.

1. Open `/login`.
2. Enter username and password, or choose passkey login if a passkey is registered.
3. Submit the login form.

Expected result: Admins go to `/admin`; vendors and clients go to `/dashboard`.

### Approve a Pending User as Admin

Prerequisites: You are logged in as an admin.

1. Open `/admin`.
2. Review the pending approvals section.
3. Select the pending user details if needed.
4. Activate the user or delete the pending account.

Expected result: Activated users can sign in and access role-specific pages.

### Manage Vendor-Client Associations as Admin

Prerequisites: You are logged in as an admin and active vendors/clients exist.

1. Open `/admin`.
2. Use the associations section.
3. Select a client and assign or remove vendors.
4. Or select a vendor and assign or remove clients.

Expected result: Client catalog visibility and vendor dashboard scope follow the association lists.

### Manage Vendor Stock

Prerequisites: You are logged in as a vendor.

1. Open `/stocks`.
2. Add a merchandise item with name, reference, category, price, stock, and optional image/threshold.
3. Edit existing items when price, stock, category, image, or threshold changes.
4. Delete discontinued items if needed.

Expected result: Assigned clients see the current catalog and realtime updates on the order page.

### Place a Client Order

Prerequisites: You are logged in as a client and at least one vendor is assigned to you.

1. Open `/order`.
2. Choose a delivery date.
3. Browse or filter catalog items.
4. Add items to the cart.
5. Adjust quantities or remove items as needed.
6. Review grouped subtotals and grand total.
7. Validate the cart.

Expected result: The cart is persisted as a validated order, stock is decremented, and the cart is cleared for that delivery date.

### Review and Settle Bills

Prerequisites: You are logged in as a vendor or client and bills exist.

1. Open `/dashboard`.
2. Select a bill list or filter.
3. Open bill details.
4. Export PDF if needed.
5. Mark the bill settled from your side when appropriate.

Expected result: Vendor and client settlement flags update independently.

### Send a Bill Comment as Client

Prerequisites: You are logged in as a client and viewing bill details.

1. Open `/dashboard`.
2. Open a bill detail view.
3. Enter the comment.
4. Send it.

Expected result: The bill stores the comment and the vendor sees it as a dashboard message.

### Create a Refund as Vendor

Prerequisites: You are logged in as a vendor and have at least one client.

1. Open `/vendor-refunds`.
2. Select a client.
3. Enter the refund amount and short comment.
4. Submit the refund.

Expected result: The refund is queued and applied as a negative bill line during daily bill generation.

### Send an Unpaid Payment Reminder as Vendor

Prerequisites: You are logged in as a vendor and a client has overdue unsettled bills.

1. Open `/vendor-overdue-bills`.
2. Review overdue unsettled bill groups by client.
3. Send a reminder for the client.

Expected result: The client sees an unpaid-payment reminder on the client dashboard.

### Discover Vendors as Client

Prerequisites: You are logged in as a client.

1. Open `/find-vendors`.
2. Browse active vendors.
3. Open a vendor modal to inspect logo and business description.
4. Add the vendor to your assigned vendor list.

Expected result: The vendor becomes assigned and its catalog can become visible on the order page.

## Configuration

End users normally do not edit environment variables. Admin-facing configuration includes:

| Setting | Who can change it | Effect |
|---------|-------------------|--------|
| Bill overdue days | Admin | Controls when unsettled bills appear as overdue. |
| App style profile | Admin | Chooses primary or secondary global CSS profile for future page loads. |
| Passkeys | Each user | Adds or removes access keys for that account. |
| Vendor/client associations | Admin, and clients through Find Vendors for adding vendors | Controls which vendors a client can order from and which clients a vendor serves. |

## Common Workflows

### Onboard a New Vendor

Features involved: Sign-up, admin approval, vendor-client association, stock management.

1. Vendor signs up on `/subscribe`.
2. Admin opens `/admin` and approves the vendor.
3. Admin assigns one or more clients to the vendor.
4. Vendor logs in and opens `/account` to complete profile details.
5. Vendor opens `/stocks` and creates merchandise.

Result: Assigned clients can see and order the vendor catalog.

### Onboard a New Client

Features involved: Sign-up, admin approval, vendor-client association, vendor discovery.

1. Client signs up on `/subscribe`.
2. Admin opens `/admin` and approves the client.
3. Admin assigns vendors to the client, or the client uses `/find-vendors` to add vendors.
4. Client opens `/order` and validates an order.

Result: The client can place orders with assigned vendors.

### Daily Ordering and Billing

Features involved: Client ordering, validated orders, daily bill generation, dashboards, PDF export.

1. Client validates a cart on `/order`.
2. The system stores a validated order and decrements stock.
3. The daily bill job groups orders by day, vendor, and client.
4. Vendor and client open `/dashboard` to view generated bills.
5. Either side exports a bill PDF or marks settlement.

Result: Daily operations are turned into vendor/client bill records.

### Refund Follow-Up

Features involved: Vendor refunds, daily bill generation, bill details.

1. Vendor opens `/vendor-refunds`.
2. Vendor creates a refund for a client with a short comment.
3. Daily bill generation applies the refund as a negative bill line.
4. Vendor and client review the adjusted bill.

Result: The client credit is reflected in the next generated bill for the vendor/client pair.

### Overdue Payment Follow-Up

Features involved: Admin overdue threshold, vendor overdue bills, penalties, reminders, client dashboard.

1. Admin sets the overdue threshold on `/admin`.
2. Vendor opens `/vendor-overdue-bills`.
3. Vendor reviews overdue unsettled bills grouped by client.
4. Vendor optionally adds a penalty line and sends a payment reminder.
5. Client sees reminders on `/dashboard` and can review unpaid bills by vendor.

Result: Overdue balances are visible and can be followed up.

## Troubleshooting

### Login Problems

#### Account is inactive

Cause: Vendor and client accounts require admin approval before normal access.

Resolution:
1. Ask an admin to approve the pending account on `/admin`.
2. Try logging in again after activation.

Prevention: Complete the admin approval step immediately after onboarding.

#### Too many login attempts

Cause: The backend rate-limits repeated failed login attempts by IP and enforces a cooldown.

Resolution:
1. Wait for the cooldown to expire.
2. Verify the username and password.
3. Try again.

Prevention: Use a password manager or passkeys after first successful login.

### Passkey Problems

#### Passkey registration or login fails

Cause: The browser, device, WebAuthn RP id, or origin may not match the server configuration.

Resolution:
1. Confirm the browser supports passkeys.
2. Use the same production domain configured for WebAuthn.
3. Ask an operator to verify WebAuthn RP id and origin configuration.

Prevention: Configure WebAuthn explicitly for production domains.

### Ordering Problems

#### Catalog is empty

Cause: The client may have no assigned vendors, or assigned vendors may have no in-stock merchandise.

Resolution:
1. Ask an admin to assign vendors, or use `/find-vendors` if available.
2. Ask vendors to confirm merchandise stock is greater than zero.
3. Refresh `/order`.

#### Cart validation fails because stock changed

Cause: Vendor stock may have changed after items were added to the cart.

Resolution:
1. Refresh the catalog.
2. Adjust item quantities.
3. Validate the cart again.

Prevention: Validate carts soon after adding items when stock is limited.

### Billing Problems

#### No bill appears for a validated order

Cause: Bills are generated by the daily bill routine, not necessarily immediately when the order is validated.

Resolution:
1. Wait for the scheduled daily billing run.
2. Ask an admin to trigger daily bill generation for the relevant day.
3. Check that the order validation day matches the bill date being generated.

#### Refund not visible yet

Cause: Refunds are queued until daily bill generation applies them.

Resolution:
1. Confirm the refund was created.
2. Run or wait for daily bill generation.
3. Open the generated bill details.

### Realtime Problems

#### Page does not update live

Cause: The WebSocket connection may be disconnected, expired, or blocked by the network/proxy.

Resolution:
1. Refresh the page to obtain a fresh websocket token.
2. Verify the network allows WebSocket upgrades to `/ws`.
3. If behind a proxy, ask an operator to check WebSocket forwarding.

Prevention: Keep reverse proxy WebSocket support enabled for `/ws`.
