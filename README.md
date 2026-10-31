# 🚖 CabGo — Modern Multi-Tenant Urban Transit & Dispatch Platform

> **Modern Enterprise Architecture**: React 19 SPA · Node.js & Express.js · Socket.IO Real-Time Engine · Leaflet GIS Maps · MySQL / TiDB Cloud Serverless  
> **Strict Language Standard**: Pure Modern JavaScript (ES Modules, JSX) — Zero TypeScript compilation overhead.

---

## 🌟 Platform Highlights

**CabGo** is a full-featured, multi-tenant urban transit dispatch and cab booking platform engineered with pure modern JavaScript across both client and server tiers.

- **4 Specialized Portals**: Dedicated workspaces for Passengers, Driver Partners, Operations Admins, and Super Administrators.
- **Race-Condition Free Dispatch**: Atomic Compare-and-Swap SQL queries (`UPDATE ... WHERE request_id = ? AND status = 'pending'`) eliminate double-booking edge cases under high concurrent driver loads.
- **Real-Time Telemetry**: Bidirectional Socket.IO event gateway for instantaneous ride dispatch, driver GPS beaconing, and status synchronization.
- **Interactive GIS HUD**: Embedded Leaflet + OpenStreetMap canvas rendering pickup/destination pins, live driver location, and route segments.
- **Tri-Modal Relational Database Adapter**: Seamless fallback across TiDB Cloud Serverless, local MySQL 2 connection pools, and zero-config in-memory relational AlaSQL for instant developer onboarding.
- **Unified Full-Stack Dev Workflow**: Run backend API (Port 5000) and frontend Vite HMR (Port 5173) in one synchronized terminal with reverse proxying.

---

## 👥 The 4 Multi-Tenant Portals

| Portal | Target Role | Key Capabilities |
| :--- | :--- | :--- |
| **Passenger** | Commuter | Search rides, calculate real road fares, request cabs, track driver live on GIS map, settle payments, submit 5-star ratings. |
| **Driver Partner** | Fleet Operator | Online/Offline toggle, live dispatch radar, atomic ride claim, turn-by-turn simulation, daily earnings summary. |
| **Operations Admin** | City Dispatcher | System health KPIs, driver document approvals, vehicle fleet audits, and dynamic Fare Rules Matrix pricing controls. |
| **Super Admin** | Platform Executive | Executive telemetry, platform policies (commission rates, cancellation fee caps), admin RBAC provisioning, and immutable audit logs. |

---

## 🔑 Pre-Seeded Test Credentials

The login screen includes one-click quick-fill buttons for instant evaluation:

| Role | Username | Password | Default Portal Route |
| :--- | :--- | :--- | :--- |
| **Passenger** | `passenger1` | `password123` | `/passenger` |
| **Driver** | `driver1` | `password123` | `/driver` |
| **Operations Admin** | `admin1` | `password123` | `/admin` |
| **Super Administrator** | `superadmin` | `password123` | `/superadmin` |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- *(Optional)* MySQL v8.0 or TiDB Cloud Serverless account (platform automatically falls back to in-memory database if no database is configured).

### 2. Installation
Install dependencies for both root and the client SPA:

```bash
# Install root backend dependencies
npm install

# Install client SPA dependencies
cd client
npm install
cd ..
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Configure database credentials or OpenRouteService API key if using real road networks; defaults work out of the box).*

### 4. Running Development Mode
Launch both the Express backend API (`http://localhost:5000`) and the React Vite client (`http://localhost:5173`) concurrently:
```bash
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

### 5. Running Production Build
Compile the React 19 frontend into optimized static assets and serve directly from Express:
```bash
npm run build:client
npm start
```

Visit **`http://localhost:5000`** in your browser.

---

## 🧪 Automated Verification Suite

Run the full end-to-end integration test suite verifying all 20 lifecycle steps across authentication, ride booking, driver acceptance, active trip simulation, ratings, admin KPIs, and superadmin policies:

```bash
npm test
```

Expected output:
```
═══════════════════════════════════
  ALL 20 TESTS PASSED — E2E complete!
═══════════════════════════════════
```

---

## 📁 Repository Structure

```
webTechProjectCIA/
├── client/                           # React 19 Single Page Application
│   ├── public/                       # Static SVGs & favicon
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/LeafletMap.jsx    # Leaflet OpenStreetMap canvas
│   │   │   └── ui/ProtectedRoute.jsx # RBAC authentication guard
│   │   ├── pages/
│   │   │   ├── admin/Dashboard.jsx   # Operations Admin portal
│   │   │   ├── auth/Login.jsx        # Unified multi-role login
│   │   │   ├── driver/Dashboard.jsx  # Driver Partner HUD
│   │   │   ├── passenger/            # Commuter booking & trip HUD
│   │   │   └── superadmin/           # Super Administrator console
│   │   ├── services/                 # Axios API & Socket.IO client
│   │   ├── store/                    # Zustand state management
│   │   ├── App.jsx                   # React Router route tree
│   │   └── main.jsx                  # React 19 DOM entrypoint
│   ├── index.html                    # SPA HTML shell
│   ├── package.json                  # Frontend dependencies (React 19, Tailwind v4)
│   └── vite.config.js                # Vite config with API reverse proxy
├── database/
│   ├── schema.sql                    # 13 relational MySQL schema tables
│   └── seed.sql                      # Pre-seeded test users, vehicles & trips
├── scripts/
│   ├── setup-tidb.js                 # Automated cloud schema migration
│   └── seed-tidb.js                  # Automated cloud data seeding
├── server/
│   ├── middleware/                   # Auth, rate limiting, logging, validation
│   ├── routes/                       # Express route controllers for all 4 roles
│   ├── schemas/                      # Zod validation schemas
│   ├── utils/                        # Dynamic fare & pricing calculators
│   ├── db.js                         # Tri-modal database connector
│   ├── router.js                     # Legacy compatibility routing layer
│   ├── server.js                     # Express + Socket.IO server entrypoint
│   ├── sseBroker.js                  # SSE fallback stream broker
│   └── telemetry.js                  # Vehicle GPS simulation generator
├── .env.example                      # Configuration template
├── .gitignore                        # Git ignore patterns
├── e2e_test.js                       # 20-step automated E2E lifecycle test runner
├── package.json                      # Backend dependencies & dev runner
└── PRODUCTION_MIGRATION_PLAN.md      # Master architecture specification & roadmap
```

---

## 📋 Technical Documentation & Migration Roadmap

For complete technical specifications, Socket.IO event signatures, concurrency safeguards, Redis GEO proximity dispatch designs, and Docker configurations, refer to:
- 📖 **[PRODUCTION_MIGRATION_PLAN.md](PRODUCTION_MIGRATION_PLAN.md)**
