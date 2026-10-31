# Rydio — Cab Booking & Dispatch Platform

> React 19 SPA · Node.js / Express · Socket.IO + Server-Sent Events · Leaflet maps · MySQL / TiDB Cloud (with in-memory fallback)
> Plain modern JavaScript on both tiers (ES modules + JSX on the client, CommonJS on the server).

---

## What it does

Rydio is a multi-role cab booking platform with four portals that share one API:

| Portal | Role | Capabilities |
| :--- | :--- | :--- |
| **Passenger** | Commuter | Fare quotes for every vehicle type, booking, live trip tracking on a map, cancel, trip history with receipts, driver ratings, profile. |
| **Driver** | Driver partner | Go online/offline, see matching ride requests, accept / start / complete trips, live route map, earnings by period, vehicle management. |
| **Operations** | Admin | Platform KPIs, recent trips and activity, driver verification (approve / reject / block), editable fare rules. |
| **Control panel** | Super admin | Platform-wide overview, platform settings (commission, tax, limits, maintenance mode), admin account provisioning, paginated audit log. |

Key behaviours:

- **Verified drivers only.** New drivers register as `pending` and cannot go online or accept rides until an admin approves them.
- **Race-free dispatch.** Accepting a ride is a conditional `UPDATE … WHERE status = 'pending'`; a second driver gets a 409.
- **Server-priced fares.** Quotes and bookings are recomputed on the server from the active fare rules and road distance (OpenRouteService if a key is set, otherwise a haversine estimate over Chennai landmarks).
- **Live tracking.** During a trip the server simulates GPS telemetry and streams it over SSE; the driver app relays its position through Socket.IO to the passenger's trip room.
- **Database fallback.** The server uses TiDB Cloud or local MySQL when configured and otherwise an in-memory relational engine seeded from `database/`. Any fallback is logged.

---

## Demo accounts

The login page has one-click buttons for these accounts. They also accept the shared shortcut password `password123`. Every other account must use its own password.

| Role | Login (email or handle) | Password |
| :--- | :--- | :--- |
| Passenger | `passenger1@cab.com` / `passenger1` | `Pass@123` |
| Driver | `driver1@cab.com` / `driver1` | `Driver@123` |
| Operations admin | `admin@cab.com` / `admin1` | `Admin@123` |
| Super admin | `superadmin@cab.com` / `superadmin` | `SuperAdmin@123` |

Additional seeded users: `driver2`–`driver5`, `passenger2`–`passenger5`, `admin2` (same role passwords).

---

## Getting started

**Prerequisites:** Node.js 18+ and npm 9+. A MySQL 8 or TiDB Cloud database is optional.

```bash
# 1. Install dependencies (server + client)
npm install
npm install --prefix client

# 2. Configure (optional — defaults use the in-memory database)
cp .env.example .env

# 3. Run in development (API on :5000, Vite client on :5173 with proxy)
npm run dev
```

Open **http://localhost:5173**.

**Production build** (Express serves the compiled client and the API from one origin):

```bash
npm run build:client
npm start          # http://localhost:5000
```

### Environment variables (`.env`)

| Variable | Purpose |
| :--- | :--- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL / TiDB connection. A non-local host is treated as TiDB Cloud (TLS). |
| `DATABASE_URL` | Alternative single connection URL for TiDB. |
| `SERVER_PORT` | API port (default `5000`). |
| `TOKEN_SECRET` | HMAC secret for auth tokens. Change this. |
| `OPENROUTESERVICE_API_KEY` | Optional. Enables real road-distance routing for fare quotes. |

To create the schema and seed a cloud database: `npm run db:setup`.

---

## Testing

```bash
npm test               # API lifecycle suite (44 checks) — boots the server itself
npm run build:client   # required once before the browser suite
npm run test:browser   # Playwright browser suite against the built app on :5000
```

The API suite covers registration, login rules, fare quotes, booking, the full driver trip lifecycle, payments, ratings, history, profile, vehicles, driver verification, admin stats and fare rules, and super-admin settings, admins and logs.

---

## Project structure

```
webTechProjectCIA/
├── client/                        # React 19 + Vite + Tailwind v4
│   ├── e2e/                       # Playwright browser tests
│   └── src/
│       ├── components/map/        # Leaflet route map
│       ├── components/ui/         # App shell, sidebar, UI kit (cards, tables, modal, toast…)
│       ├── pages/{auth,passenger,driver,admin,superadmin}/
│       ├── services/              # axios client (same-origin /api), Socket.IO client
│       ├── store/                 # Zustand auth + trip state (persisted)
│       └── utils/format.js        # date / currency / distance formatting
├── database/                      # schema.sql, seed.sql (13 tables)
├── scripts/                       # TiDB setup & seed scripts
├── server/
│   ├── middleware/                # auth tokens, rate limiting, audit logging
│   ├── routes/                    # auth, passenger, driver, payments, ratings, admin, superadmin, stream (SSE)
│   ├── utils/fareCalculator.js    # distance + fare computation
│   ├── db.js                      # TiDB / MySQL / in-memory adapter
│   ├── sseBroker.js               # SSE subscriptions & broadcasts
│   ├── telemetry.js               # trip GPS simulation
│   └── server.js                  # Express + Socket.IO entry point
├── e2e_test.js                    # API lifecycle test runner
└── PRODUCTION_MIGRATION_PLAN.md   # Architecture notes & roadmap
```

---

## API overview

All routes are prefixed with `/api` and, except for `auth/*`, `health` and `rides/search`, require `Authorization: Bearer <token>`.

| Area | Routes |
| :--- | :--- |
| Auth | `POST auth/register`, `POST auth/login`, `POST auth/logout`, `GET auth/me` |
| Passenger | `GET rides/search`, `POST rides/book`, `GET rides/status/:id`, `POST rides/cancel/:id`, `GET rides/history`, `GET/PUT passenger/profile`, `GET passenger/dashboard`, `GET passenger/payments` |
| Driver | `PUT driver/availability`, `GET driver/dashboard`, `GET driver/ride-requests`, `PUT driver/ride-requests/:id/accept|reject`, `PUT driver/trips/:id/start|complete`, `GET driver/earnings`, `GET/POST/PUT/DELETE driver/vehicles` |
| Shared | `POST ratings`, `GET ratings/trip/:id`, `GET payments/trip/:id` |
| Admin | `GET admin/stats`, `GET admin/drivers`, `PUT admin/drivers/:id/approve|reject|block|unblock`, `GET/POST/PUT/DELETE admin/fare-rules`, `GET admin/trips`, `GET admin/vehicles`, `GET admin/reports/*` |
| Super admin | `GET superadmin/overview`, `GET/PUT superadmin/settings`, `GET/POST/PUT/DELETE superadmin/admins`, `GET superadmin/logs` |
| Streams | `GET stream/trip/:id`, `GET stream/driver-dispatch`, `GET stream/admin-live` (SSE, token via `?token=`) |
