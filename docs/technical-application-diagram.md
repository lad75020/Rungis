# Rungis Technical Application Diagram

Generated: 2026-06-21 03:29:57 CEST

## Codebase-memory evidence

- Project id: `Volumes-WDBlack4TB-Code-rungis`
- Root path: `/Volumes/WDBlack4TB/Code/rungis`
- Index status: `ready`
- Graph size: 2962 nodes and 4520 edges
- Schema highlights: 305 Function nodes, 197 Method nodes, 216 File nodes, 216 Module nodes, 72 Route nodes, 4 Channel nodes
- Route trace evidence: `registerRoutes` calls `createRouteContext`, `registerPageRoutes`, `registerAuthRoutes`, `registerManagementRoutes`, `registerBillRoutes`, `registerRungisBillRoutes`, `registerRefundRoutes`, and `registerWebsocketRoutes`
- Source evidence: `backend/src/server.js`, `backend/src/routes/index.js`, `backend/src/routes/modules/*.js`, `frontend/src/app/app.ts`, `frontend/src/app/app.routes.ts`, `frontend/src/app/pages/*.component.ts`, `frontend/angular.json`

## 1. Runtime container view

```mermaid
flowchart LR
    subgraph Users[Users]
        Admin[Admin]
        Vendor[Vendor]
        Client[Client]
    end

    subgraph Browser[Browser]
        Shell[EJS page shell]
        Angular[Angular 22 standalone app]
        LazyRoutes[Lazy routed page components]
        AppState[Root App state and signals]
        Theme[Theme mode and style profile]
    end

    subgraph Backend[Fastify 5 backend]
        Server[server.js bootstrap]
        Pages[Page routes and guards]
        Rest[REST route modules]
        WS[/ws authenticated WebSocket]
        RouteContext[Route context and domain helpers]
        Security[Security headers, sessions, JWT, rate guards]
        Static[Static uploads and Angular assets]
        Documents[PDF and Factur-X services]
    end

    subgraph Stores[Runtime stores]
        Mongo[(MongoDB via Mongoose)]
        Redis[(Redis sessions, live carts, rate state, reminders)]
        SQLite[(SQLite app settings)]
        Files[(Uploaded logos, item images, Angular build)]
    end

    Admin --> Browser
    Vendor --> Browser
    Client --> Browser
    Browser -->|GET page route| Pages
    Pages -->|buildPagePayload| RouteContext
    Pages -->|render appConfig| Shell
    Shell -->|window.__APP_CONFIG__| Angular
    Angular --> LazyRoutes
    LazyRoutes -->|inject App and activateRoutedPage| AppState
    Angular -->|fetch| Rest
    Angular -->|short-lived websocket credential| WS
    Server --> Pages
    Server --> Rest
    Server --> WS
    Server --> Security
    Server --> Static
    Rest --> RouteContext
    WS --> RouteContext
    Rest --> Documents
    Documents --> RouteContext
    RouteContext --> Mongo
    RouteContext --> Redis
    RouteContext --> SQLite
    Static --> Files
    Rest --> Files
    RouteContext -->|broadcast updates| WS
```

## 2. Backend component view

```mermaid
flowchart TB
    Server[backend/src/server.js]

    subgraph Plugins[Fastify plugin stack]
        Cookie[@fastify/cookie]
        FormBody[@fastify/formbody]
        Jwt[@fastify/jwt]
        Session[@fastify/session + RedisStore]
        Websocket[@fastify/websocket]
        View[@fastify/view + EJS]
        StaticPlugin[@fastify/static]
        Headers[registerSecurityHeaders]
    end

    subgraph Routing[backend/src/routes]
        Register[registerRoutes]
        Context[createRouteContext]
        PageRoutes[modules/pages.js]
        AuthRoutes[modules/auth.js]
        MgmtRoutes[modules/management.js]
        BillRoutes[modules/bills.js]
        RungisBillRoutes[modules/rungis-bills.js]
        RefundRoutes[modules/refunds.js]
        WsRoutes[modules/websocket.js]
    end

    subgraph Services[Service modules]
        FacturXData[factur-x/invoice-data.js]
        FacturXGenerator[factur-x/generator.js]
        FacturXValidation[factur-x/validation.js]
        RungisGen[rungis-bills/generation.js]
        RungisSettings[rungis-bills/settings.js]
        RungisInvoice[rungis-bills/invoice-data.js]
        RungisPdf[rungis-bills/pdf.js]
        Vat[utils/vat.js]
    end

    subgraph Models[Mongoose models]
        User[User]
        Merchandise[Merchandise]
        ValidatedOrder[ValidatedOrder]
        Bill[Bill]
        Refund[Refund]
        RungisBill[RungisBill]
        Cart[Cart legacy model]
    end

    Server --> Plugins
    Server --> Register
    Register --> Context
    Register --> PageRoutes
    Register --> AuthRoutes
    Register --> MgmtRoutes
    Register --> BillRoutes
    Register --> RungisBillRoutes
    Register --> RefundRoutes
    Register --> WsRoutes
    Context --> Models
    Context --> Vat
    BillRoutes --> FacturXData
    BillRoutes --> FacturXGenerator
    BillRoutes --> FacturXValidation
    RungisBillRoutes --> RungisInvoice
    RungisBillRoutes --> RungisPdf
    RungisBillRoutes --> FacturXGenerator
    MgmtRoutes --> RungisGen
    MgmtRoutes --> RungisSettings
    WsRoutes --> Models
    RefundRoutes --> Refund
```

## 3. Frontend lazy-route and state view

```mermaid
flowchart TB
    Main[frontend/src/main.ts]
    Config[app.config.ts provideRouter]
    Routes[app.routes.ts]
    Root[App root component]
    Header[AppHeaderComponent]
    Toasts[ToastStackComponent]
    Template[app.html shared shell]

    subgraph LazyPages[Lazy-loaded standalone page wrappers]
        Dashboard[DashboardPageComponent]
        Admin[AdminPageComponent]
        Statistics[StatisticsPageComponent]
        Stocks[StocksPageComponent]
        Order[OrderPageComponent]
        Legacy[LegacyPagePlaceholderComponent]
    end

    subgraph RootState[Root App-owned state]
        Session[sessionUser, role, language]
        DashboardState[dashboard filters, bill selections, vendorBillsTab]
        AdminState[pending users, associations, settings, Rungis bill admin]
        OrderState[catalog, filters, cart, delivery date]
        StockState[merchandise, stock forms, uploads]
        BillingState[bill details, refunds, reminders, settlement]
        WsState[websocket connection, token refresh, request map]
    end

    subgraph IO[Browser I/O]
        Fetch[REST fetch calls]
        Socket[WebSocket API calls]
        Bootstrap[window.__APP_CONFIG__]
        Theme[style profile and local theme mode]
    end

    Main --> Config
    Config --> Routes
    Config --> Root
    Root --> Header
    Root --> Toasts
    Root --> Template
    Template --> Routes
    Routes --> Dashboard
    Routes --> Admin
    Routes --> Statistics
    Routes --> Stocks
    Routes --> Order
    Routes --> Legacy
    Dashboard -->|inject App; activate dashboard| Root
    Admin -->|inject App; activate admin| Root
    Statistics -->|inject App; activate statistics| Root
    Stocks -->|inject App; activate stocks| Root
    Order -->|inject App; activate order| Root
    Legacy -->|activate legacy page from config| Root
    Root --> RootState
    RootState --> Fetch
    RootState --> Socket
    Bootstrap --> Root
    Theme --> Root
```

## 4. Business data and event-flow view

```mermaid
flowchart LR
    subgraph Auth[Account lifecycle]
        Subscribe[Vendor/client signup]
        Approval[Admin approval]
        Session[Session cookie]
        Passkeys[WebAuthn passkeys]
    end

    subgraph Ordering[Catalog, stock, ordering]
        VendorStocks[Vendor manages merchandise]
        Catalog[Client sees assigned-vendor catalog]
        Cart[Redis-backed live cart]
        Validate[Validate cart]
        StockBroadcast[Stock and catalog broadcasts]
    end

    subgraph Billing[Billing and settlement]
        ValidatedOrders[ValidatedOrder documents]
        DailyJob[Daily bill generation]
        Refunds[Queued vendor refunds]
        Bills[Bill documents]
        Settlement[Vendor/client settlement flags]
        Comments[Client bill comments and vendor messages]
        Documents[PDF and Factur-X downloads]
    end

    subgraph RungisFee[Rungis platform fees]
        FeeSettings[Fee and VAT settings]
        MonthGeneration[Monthly platform bill generation]
        RungisInvoices[RungisBill documents]
        PaidState[Admin paid marking]
    end

    Subscribe --> Approval
    Approval --> Session
    Session --> Passkeys
    Approval --> Catalog
    VendorStocks --> Catalog
    Catalog --> Cart
    Cart --> Validate
    Validate --> ValidatedOrders
    Validate --> StockBroadcast
    ValidatedOrders --> DailyJob
    Refunds --> DailyJob
    DailyJob --> Bills
    Bills --> Settlement
    Bills --> Comments
    Bills --> Documents
    ValidatedOrders --> MonthGeneration
    FeeSettings --> MonthGeneration
    MonthGeneration --> RungisInvoices
    RungisInvoices --> PaidState
    RungisInvoices --> Documents
```

## 5. Page-to-backend interaction map

```mermaid
flowchart TB
    subgraph Pages[Angular pages]
        Dashboard[dashboard]
        Admin[admin]
        Stats[statistics / vendor statistics]
        Stocks[stocks]
        Order[order]
        Account[account]
    end

    subgraph REST[REST modules]
        Auth[auth.js]
        Management[management.js]
        Bills[bills.js]
        RungisDocs[rungis-bills.js]
        Refunds[refunds.js]
    end

    subgraph WS[WebSocket actions]
        DashboardActions[dashboard:*]
        StockActions[stocks:*]
        OrderActions[order:*]
        AuthActions[auth:*]
    end

    Dashboard --> DashboardActions
    Dashboard --> Bills
    Dashboard --> RungisDocs
    Dashboard --> Management
    Admin --> Management
    Stats --> Management
    Stocks --> StockActions
    Stocks --> Auth
    Order --> OrderActions
    Account --> Auth
    Refunds --> Management
    DashboardActions --> Bills
    StockActions --> Management
    OrderActions --> Management
```
