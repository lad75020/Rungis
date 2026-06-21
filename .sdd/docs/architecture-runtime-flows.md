# Rungis Runtime Flows and Component Interactions

Generated: 2026-06-21 03:29:57 CEST

## Evidence

- Codebase-memory project: `Volumes-WDBlack4TB-Code-rungis`
- Index status: ready, 2962 nodes, 4520 edges
- Route trace: `registerRoutes` registers page, auth, management, bill, Rungis bill, refund, and websocket modules
- WebSocket action inventory from `backend/src/routes/modules/websocket.js`
- REST route inventory from route modules and generated runtime API docs

## 1. Runtime container view

```mermaid
flowchart LR
    Admin[Admin user]
    Vendor[Vendor user]
    Client[Client user]

    subgraph Browser[Browser]
        EJS[EJS shell]
        Angular[Angular 22 App]
        Lazy[Lazy page wrappers]
        Toasts[Toast and alert stack]
        WSClient[WebSocket client]
    end

    subgraph Fastify[Fastify process]
        Plugins[Cookie, form body, session, JWT, websocket, view, static]
        Pages[Page routes]
        Rest[REST APIs]
        WS[/ws API]
        Context[Route context]
        Docs[PDF and Factur-X services]
    end

    subgraph Data[Data and assets]
        Mongo[(MongoDB)]
        Redis[(Redis)]
        SQLite[(SQLite)]
        Public[(public uploads and Angular assets)]
    end

    Admin --> Browser
    Vendor --> Browser
    Client --> Browser
    Browser --> Pages
    Pages --> EJS
    EJS --> Angular
    Angular --> Lazy
    Angular --> Toasts
    Angular --> Rest
    WSClient --> WS
    Rest --> Context
    WS --> Context
    Context --> Mongo
    Context --> Redis
    Context --> SQLite
    Rest --> Docs
    Docs --> Mongo
    Rest --> Public
    Pages --> Public
```

## 2. Backend route composition

```mermaid
flowchart TB
    Server[server.js]
    Register[registerRoutes]
    Context[createRouteContext]

    subgraph Modules[Route modules]
        Pages[pages.js]
        Auth[auth.js]
        Management[management.js]
        Bills[bills.js]
        RungisBills[rungis-bills.js]
        Refunds[refunds.js]
        Websocket[websocket.js]
    end

    subgraph Shared[Shared dependencies]
        Guards[Role guards]
        Models[Mongoose models]
        RedisHelpers[Redis cart and reminder helpers]
        Settings[SQLite settings helpers]
        Billing[Bill generation helpers]
        Vat[VAT helpers]
        FacturX[Factur-X sender]
        Broadcasts[Connection maps and broadcasts]
    end

    Server --> Register
    Register --> Context
    Register --> Pages
    Register --> Auth
    Register --> Management
    Register --> Bills
    Register --> RungisBills
    Register --> Refunds
    Register --> Websocket
    Context --> Shared
    Auth --> Guards
    Management --> Guards
    Bills --> Guards
    RungisBills --> Guards
    Refunds --> Guards
    Websocket --> Guards
    Management --> Settings
    Management --> Billing
    Bills --> FacturX
    RungisBills --> FacturX
    Websocket --> RedisHelpers
    Websocket --> Broadcasts
```

## 3. Frontend routing and state ownership

```mermaid
flowchart TB
    Main[main.ts]
    Config[app.config.ts]
    Routes[app.routes.ts]
    App[App root component]

    subgraph Pages[Lazy page wrappers]
        Dashboard[DashboardPageComponent]
        Admin[AdminPageComponent]
        Statistics[StatisticsPageComponent]
        Stocks[StocksPageComponent]
        Order[OrderPageComponent]
        Legacy[LegacyPagePlaceholderComponent]
    end

    subgraph State[App-owned signal state]
        Session[session and role]
        AdminState[admin users, associations, settings]
        StockState[stock form and list]
        OrderState[catalog, cart, favorites]
        DashboardState[bills, comments, settlement]
        RungisState[Rungis bill controls and invoices]
        Transport[fetch and websocket request maps]
    end

    Main --> Config
    Config --> Routes
    Config --> App
    Routes --> Dashboard
    Routes --> Admin
    Routes --> Statistics
    Routes --> Stocks
    Routes --> Order
    Routes --> Legacy
    Dashboard -->|injects App| App
    Admin -->|injects App| App
    Statistics -->|injects App| App
    Stocks -->|injects App| App
    Order -->|injects App| App
    App --> State
```

## 4. Page bootstrap sequence

```mermaid
sequenceDiagram
    participant B as Browser
    participant P as Fastify page route
    participant G as Guard
    participant S as Redis session
    participant Q as SQLite settings
    participant T as Translations
    participant E as EJS
    participant A as Angular App

    B->>P: GET /dashboard, /admin, /stocks, /order, or other page
    P->>G: run page rate limit and role guard
    G->>S: read session user
    P->>Q: read app style profile and settings
    P->>T: resolve translations
    P->>P: build page payload and websocket credential
    P->>E: render page shell
    E-->>B: HTML with appConfig and Angular asset references
    B->>A: load Angular bundle
    A->>A: initialize signals from appConfig
    A->>A: activate lazy page and page-specific loads
```

## 5. WebSocket connection and request flow

```mermaid
sequenceDiagram
    participant A as Angular App
    participant Auth as Auth REST
    participant WS as /ws route
    participant JWT as JWT verifier
    participant Map as Connection maps
    participant Handler as Action handler
    participant Store as MongoDB or Redis

    A->>Auth: GET /api/ws-token?page=currentPage when reconnecting
    Auth-->>A: fresh websocket credential
    A->>WS: connect with query parameter named token
    WS->>JWT: verify credential and role/page claims
    WS->>Map: register socket under active page and role
    WS-->>A: welcome event
    A->>WS: api message with requestId and action
    WS->>Handler: dispatch by action namespace
    Handler->>Handler: validate role, ids, dates, amounts, dangerous keys
    Handler->>Store: read/write state
    Handler-->>A: api:result for requestId
    Handler-->>Map: broadcast relevant updates
```

## 6. WebSocket action map

| Namespace | Actions | Primary users | State touched |
|-----------|---------|---------------|---------------|
| `auth` | `auth:username-available` | unauthenticated/signup | User lookup |
| `stocks` | list, create, update, delete | vendor | Merchandise, stock broadcasts |
| `order` | catalog, favorites toggle, cart get/set/add/update/remove/validate | client | Merchandise, Redis carts, ValidatedOrder, stock updates |
| `dashboard:vendor-bills` | list, clients, list by client range, details, settle | vendor | Bill, settlement maps, comments |
| `dashboard:vendor-bill-messages` | list, read, dismiss | vendor | Bill comment/message state |
| `dashboard:client-bills` | list, vendors, unpaid by vendor, details, comment, settle | client | Bill, reminders, settlements |
| `dashboard:client-carts` | list, details | client | Redis cart and validated order summaries |
| `dashboard:vendor-orders` | list, details | vendor | ValidatedOrder and bill detail helpers |

## 7. Order and cart flow

```mermaid
sequenceDiagram
    participant C as Client Angular App
    participant WS as WebSocket API
    participant Redis as Redis cart store
    participant Merch as Merchandise collection
    participant Orders as ValidatedOrder collection
    participant Vendors as Vendor sockets

    C->>WS: order:catalog
    WS->>Merch: find assigned-vendor merchandise
    WS-->>C: catalog, favorites, vendors, categories
    C->>WS: order:cart:set-delivery-date
    WS->>Redis: set active cart date
    C->>WS: order:cart:add/update/remove
    WS->>Redis: save normalized cart
    WS-->>C: updated cart
    C->>WS: order:cart:validate
    WS->>Orders: create validated order with frozen prices and VAT
    WS->>Merch: decrement stock
    WS-->>Vendors: stock/catalog refresh broadcasts
    WS-->>C: validation totals and new cart state
```

## 8. Billing and document flow

```mermaid
flowchart TD
    Orders[ValidatedOrder rows] --> Daily[generateBillsForDay]
    Refunds[Refund rows] --> Daily
    Daily --> Bills[Bill documents]
    Bills --> Detail[Vendor/client bill detail]
    Bills --> Pdf[sendBillPdf PDFKit renderer]
    Bills --> Normalize[normalizeBillToFacturXData]
    Normalize --> Check{Complete and reconciled}
    Check -->|no| JsonError[JSON error response]
    Check -->|yes| Generate[generateFacturXBill]
    Generate --> Export[Factur-X PDF response]
    Orders --> RungisGen[generateRungisBillsForMonth]
    RungisGen --> RungisBill[RungisBill documents]
    RungisBill --> RungisPdf[sendRungisBillPdf]
    RungisBill --> RungisFx[buildRungisFacturXInput]
```

## 9. Rungis platform bill flow

```mermaid
sequenceDiagram
    participant Admin as Admin UI
    participant API as Management API
    participant Settings as SQLite Rungis settings
    participant Orders as ValidatedOrder
    participant Users as User collection
    participant RB as RungisBill collection
    participant Docs as Rungis bill document services

    Admin->>API: configure fee and VAT rates
    API->>Settings: persist rates and processed months
    Admin->>API: send/generate bills for month
    API->>Settings: verify configured and not already processed
    API->>Orders: aggregate prior month totals by role and user
    API->>Users: load admin and billed user identity snapshots
    API->>RB: upsert unpaid Rungis bills, skip paid bills
    API->>Settings: mark processed month
    Admin->>API: search unpaid Rungis bills or mark paid
    API-->>Admin: summaries
    User->>Docs: download PDF or Factur-X for own Rungis bill
```

## 10. Data ownership summary

| Data | Owner | Store | Notes |
|------|-------|-------|-------|
| User identity and role | Auth/admin routes | MongoDB `User` | Activation, passkeys, legal fields, relationships |
| Merchandise and stock | Vendor websocket actions | MongoDB `Merchandise` | Broadcast updates after changes |
| Active cart | Client websocket actions | Redis | Durable only after validation |
| Validated orders | Order validation | MongoDB `ValidatedOrder` | Frozen billing source data |
| Daily bills | Bill generation | MongoDB `Bill` | Settlement, comments, refunds, penalties |
| Rungis platform bills | Rungis bill services | MongoDB `RungisBill` | Monthly user invoices for platform fees |
| Refunds | Refund route | MongoDB `Refund` | Applied to bills through generation/helpers |
| Reminders | Management routes | Redis | Transient unpaid reminder notifications |
| App settings | Management/settings services | SQLite | Style, overdue days, Rungis bill rates/months |
| Uploaded assets | Auth/upload routes | Filesystem | Logos and item images under public assets |
