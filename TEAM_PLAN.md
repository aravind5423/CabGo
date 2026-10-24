# 🚖 Online Cab Booking System — Team Project Plan

> **Web Technology CIA Assignment**  
> **Stack**: HTML/CSS · Vanilla JavaScript · DOM · AJAX/Fetch · Node.js (built-in modules only) · MySQL  
> **Restriction**: ❌ No React, Angular, Vue, Express.js, or any external web framework  
> **Cadence**: 2–3 commits per day → ~30 commits total over 10 days

---

## 👥 Team Workflow Rules

1. **Commit naming convention**: `feat(scope): description` | `fix(scope): description` | `chore: description`
2. **One commit = one logical unit** — don't bundle unrelated changes
3. **Test your API** with a browser fetch or Postman before committing
4. **Never push broken code to main** — use feature branches if working in parallel
5. **Database changes** always go in `database/schema.sql` — never alter DB manually without updating the file

---

## 📁 Full Project Folder Structure

```
cab-booking/                          ← project root
├── server/
│   ├── server.js                     # Entry point – raw Node.js http server
│   ├── router.js                     # URL dispatcher (replaces express router)
│   ├── db.js                         # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js                   # Token validation + role extraction
│   │   └── logger.js                 # Writes to system_logs table on every API call
│   ├── routes/
│   │   ├── auth.js                   # Register, login, logout, /me
│   │   ├── passenger.js              # Passenger-specific APIs
│   │   ├── driver.js                 # Driver-specific APIs
│   │   ├── admin.js                  # Admin APIs
│   │   └── superadmin.js             # Super Admin APIs
│   └── utils/
│       └── fareCalculator.js         # Fare estimation logic
├── public/
│   ├── index.html                    # Landing page (public)
│   ├── login.html                    # Login page (public)
│   ├── register.html                 # Registration page (public)
│   ├── search-ride.html              # Search available rides (public)
│   ├── passenger/
│   │   ├── dashboard.html
│   │   ├── book-ride.html
│   │   ├── active-trip.html
│   │   ├── trip-history.html
│   │   └── profile.html
│   ├── driver/
│   │   ├── dashboard.html
│   │   ├── ride-requests.html
│   │   ├── active-trip.html
│   │   ├── vehicles.html
│   │   ├── earnings.html
│   │   └── profile.html
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── manage-passengers.html
│   │   ├── manage-drivers.html
│   │   ├── manage-vehicles.html
│   │   ├── manage-trips.html
│   │   ├── fare-rules.html
│   │   └── reports.html
│   ├── superadmin/
│   │   ├── dashboard.html
│   │   ├── manage-admins.html
│   │   ├── permissions.html
│   │   ├── system-logs.html
│   │   └── system-settings.html
│   ├── css/
│   │   ├── global.css                # Design tokens, typography, dark mode base
│   │   ├── auth.css                  # Login/register page styles
│   │   ├── dashboard.css             # Dashboard layouts (sidebar, cards)
│   │   └── components.css            # Modals, toasts, tables, buttons
│   └── js/
│       ├── api.js                    # Fetch wrapper with token injection + error handling
│       ├── auth.js                   # Login/logout/register DOM logic
│       ├── router-guard.js           # Role-based page access guard
│       ├── passenger/
│       │   ├── dashboard.js
│       │   ├── book-ride.js
│       │   ├── active-trip.js
│       │   └── trip-history.js
│       ├── driver/
│       │   ├── dashboard.js
│       │   ├── ride-requests.js
│       │   ├── active-trip.js
│       │   └── earnings.js
│       ├── admin/
│       │   ├── dashboard.js
│       │   ├── manage-users.js
│       │   ├── manage-trips.js
│       │   └── reports.js
│       └── superadmin/
│           ├── dashboard.js
│           ├── manage-admins.js
│           └── system-logs.js
├── database/
│   ├── schema.sql                    # Full DDL – all 12 tables with FK constraints
│   └── seed.sql                      # Demo data
├── .env                              # DB credentials (NEVER commit this)
├── .env.example                      # Template for env vars (commit this)
├── .gitignore
├── package.json
└── TEAM_PLAN.md                      # ← YOU ARE HERE
```

---

## 🗓️ 10-Day Execution Plan

---

### ✅ DAY 1 — Project Scaffolding + Database Design + Raw Server
**Goal**: Repo initialized, DB schema finalized, raw server running on localhost:3000

#### Commit 1 — `chore: project scaffold & package.json`
- [x] Create full folder structure (empty files/folders)
- [x] Initialize `package.json` (only allowed dependency: `mysql2`)
- [x] Create `.gitignore` (node_modules, .env)
- [x] Create `.env.example` with DB config template
- [x] Write basic `README.md`

#### Commit 2 — `feat(db): complete MySQL schema – all 12 tables`
- [x] `database/schema.sql` — all 12 tables with PK/FK/INDEX/ENUM:
  - `users`, `passenger_profiles`, `driver_profiles`
  - `vehicles`, `service_areas`, `fare_rules`
  - `ride_requests`, `trips`, `payments`
  - `ratings_reviews`, `admin_permissions`, `system_logs`

#### Commit 3 — `feat(server): raw Node.js HTTP server + DB pool + router + logger`
- [x] `server/db.js` — MySQL2 pool with `.env` config
- [x] `server/server.js` — `http.createServer`, static file serving from `/public`
- [x] `server/router.js` — URL pattern matching dispatcher
- [x] `server/middleware/logger.js` — logs every API call to `system_logs`
- [x] **Test**: `node server/server.js` → `localhost:3000` serves index.html

---

### ✅ DAY 2 — Authentication APIs + Public Pages UI
**Goal**: Registration, login, HMAC-signed session token, public HTML pages live

#### Commit 1 — `feat(auth): register & login REST APIs`
- [x] `POST /api/auth/register` — insert `users` + role profile
- [x] `POST /api/auth/login` — validate, return HMAC-signed token
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me` — decode token, return user info
- [x] `server/middleware/auth.js` — token decode + role check

#### Commit 2 — `feat(ui): index.html, login.html, register.html`
- [x] `public/index.html` — Landing: hero, features, CTAs
- [x] `public/login.html` — Login form with Fetch submission
- [x] `public/register.html` — Tabbed: Passenger / Driver tabs
- [x] `public/css/global.css` — color palette, typography (Inter, Outfit), CSS variables
- [x] `public/css/auth.css` — glassmorphism cards, gradients
- [x] `public/js/api.js` — reusable fetch wrapper
- [x] `public/js/auth.js` — form logic, DOM error display, redirect on success

#### Commit 3 — `feat(ui): search-ride.html + role-based route guard`
- [x] `public/search-ride.html` — pickup/destination inputs, vehicle filter
- [x] `public/js/router-guard.js` — read token from `sessionStorage`, decode role, redirect if unauthorized

---

### ✅ DAY 3 — Passenger Dashboard + Book Ride APIs
**Goal**: Passenger can search, book, track, and view trip history

#### Commit 1 — `feat(api): ride search + book ride endpoints`
- [x] `GET /api/rides/search?pickup=&destination=&type=`
- [x] `POST /api/rides/book` — insert `ride_requests`, status = `pending`
- [x] `GET /api/rides/status/:request_id`
- [x] `POST /api/rides/cancel/:request_id` — only if `pending`

#### Commit 2 — `feat(ui): passenger-dashboard.html + book-ride.html`
- [x] Dashboard: summary cards, recent bookings list (AJAX), quick actions
- [x] Book-ride: pickup + destination, vehicle selector, fare estimate (AJAX), confirm booking

#### Commit 3 — `feat(ui): active-trip.html + trip-history.html (passenger)`
- [x] Active trip: poll status every 5 sec via `setInterval` + Fetch, cancel button
- [x] Trip history: table DOM-rendered from Fetch, date filter without reload

---

### ✅ DAY 4 — Driver Dashboard + Ride Management APIs
**Goal**: Driver can go online, receive requests, accept/reject, start/end trips

#### Commit 1 — `feat(api): driver availability + ride request APIs`
- [x] `PUT /api/driver/availability` — toggle online/offline
- [x] `GET /api/driver/ride-requests` — pending requests
- [x] `PUT /api/driver/ride-requests/:id/accept`
- [x] `PUT /api/driver/ride-requests/:id/reject`
- [x] `PUT /api/driver/trips/:id/start`
- [x] `PUT /api/driver/trips/:id/complete`

#### Commit 2 — `feat(ui): driver-dashboard.html + ride-requests.html`
- [x] Dashboard: online/offline toggle, live stats, ride request notification (poll 10 sec)
- [x] Ride requests: list with accept/reject buttons, DOM status update (no reload)

#### Commit 3 — `feat(ui): driver active-trip.html + earnings.html`
- [x] Active trip: Start → Complete flow, status badge DOM update
- [x] Earnings: total + per-trip breakdown, date filter (week/month)

---

### ✅ DAY 5 — Vehicle Management + Driver Profile + Ratings
**Goal**: Drivers manage vehicles; passengers rate completed trips

#### Commit 1 — `feat(api): vehicle CRUD + profile APIs`
- [x] `GET/POST/PUT/DELETE /api/driver/vehicles`
- [x] `GET/PUT /api/driver/profile`
- [x] `GET/PUT /api/passenger/profile`

#### Commit 2 — `feat(ui): vehicles.html + profile pages`
- [x] Vehicles: table + Add/Edit modal + Delete → Fetch CRUD, DOM update
- [x] Profile pages (driver + passenger): editable form, success toast on save

#### Commit 3 — `feat(api+ui): ratings & reviews module`
- [x] `POST /api/ratings` — submit after trip complete
- [x] `GET /api/ratings/driver/:id` / `GET /api/ratings/passenger/:id`
- [x] Star-rating widget post-trip modal
- [x] Driver profile: average rating + reviews list (DOM rendered)

---

### ✅ DAY 6 — Payment Module + Fare Rules APIs
**Goal**: Payment recording; admin fare rule and service area management

#### Commit 1 — `feat(api): payments module`
- [x] `POST /api/payments` — record payment (auto-trigger on trip complete)
- [x] `GET /api/payments/trip/:trip_id`
- [x] `GET /api/passenger/payments` — payment history

#### Commit 2 — `feat(api): admin – fare rules + service areas APIs`
- [x] `GET/POST/PUT/DELETE /api/admin/fare-rules`
- [x] `GET/POST/PUT/DELETE /api/admin/service-areas`
- [x] `server/utils/fareCalculator.js`: `estimatedFare = base_fare + (km × per_km_rate) + (min × per_minute_rate)`

#### Commit 3 — `feat(ui): fare-rules.html (admin)`
- [x] Fare rules table + Add/Edit modal CRUD via Fetch, DOM-updated
- [x] Service areas table + same CRUD pattern

---

### ✅ DAY 7 — Admin Dashboard + Manage Users/Trips
**Goal**: Admin can manage all passengers, drivers, vehicles, and trips

#### Commit 1 — `feat(api): admin – users & vehicles management APIs`
- [x] `GET /api/admin/passengers` (paginated)
- [x] `GET /api/admin/drivers`
- [x] `PUT /api/admin/drivers/:id/approve|reject|block|unblock`
- [x] `PUT /api/admin/passengers/:id/block|unblock`
- [x] `GET /api/admin/vehicles` + `PUT /api/admin/vehicles/:id/status`

#### Commit 2 — `feat(ui): admin-dashboard.html + manage-passengers/drivers.html`
- [x] Dashboard: KPI cards, activity feed, vanilla Canvas charts
- [x] Manage passengers: search + paginate + block/unblock (DOM update)
- [x] Manage drivers: approve/reject/block with confirmation modal

#### Commit 3 — `feat(ui): manage-vehicles.html + manage-trips.html (admin)`
- [x] Vehicles: all vehicles table, activate/deactivate
- [x] Trips: filter by status, admin mark-complete

---

### ✅ DAY 8 — Reports Module + Super Admin Foundation
**Goal**: Admin reports with live charts; Super Admin user management

#### Commit 1 — `feat(api): reports + system logs APIs`
- [x] `GET /api/admin/reports/revenue?from=&to=`
- [x] `GET /api/admin/reports/trips?status=&from=&to=`
- [x] `GET /api/admin/reports/drivers`
- [x] `GET /api/superadmin/logs?user=&action=&from=&to=`

#### Commit 2 — `feat(ui): reports.html (admin)`
- [x] Date pickers + filters, revenue table + vanilla Canvas bar chart
- [x] Driver performance table, CSV export via DOM Blob download

#### Commit 3 — `feat(api+ui): superadmin – admins + permissions`
- [x] `GET/POST/PUT/DELETE /api/superadmin/admins`
- [x] `PUT /api/superadmin/admins/:id/activate|deactivate`
- [x] `GET/POST/DELETE /api/superadmin/permissions/:admin_id`
- [x] `manage-admins.html` + `permissions.html`

---

### ✅ DAY 9 — Super Admin Settings + System Logs + Security Hardening
**Goal**: Super Admin panel complete; security & middleware polished

#### Commit 1 — `feat(ui): superadmin-dashboard.html + system-logs.html`
- [x] Dashboard: global KPIs, all admin overview
- [x] System logs: filter by user/action/date/IP, paginated DOM table

#### Commit 2 — `feat(ui): system-settings.html`
- [x] Platform settings: name, currency, max cancellations, maintenance mode toggle
- [x] `PUT /api/superadmin/settings`

#### Commit 3 — `feat(security): input validation, rate limiting, RBAC hardening`
- [x] Server-side input sanitization on all POST/PUT routes
- [x] `server/middleware/rateLimit.js` — in-memory IP rate limiting
- [x] Audit all routes: token + role enforced everywhere
- [x] CORS headers in `server.js`
- [x] `system_logs` written on all CUD operations

---

### ✅ DAY 10 — UI Polish + Validation + Testing + Final Release
**Goal**: System fully integrated, polished, seeded, tagged v1.0.0

#### Commit 1 — `feat(ui): global UI polish + responsive design`
- [x] Dark mode palette finalized across all pages
- [x] Mobile-first responsive breakpoints
- [x] Sidebar nav component for all dashboards
- [x] Toast notification system (success/error)
- [x] Skeleton loaders during Fetch calls
- [x] All pages: `<title>`, meta description, semantic HTML5 elements

#### Commit 2 — `feat(validation): client-side form validation + error handling`
- [x] `public/js/validator.js` — email, phone, password strength, required fields
- [x] Wire to all forms: register, book, vehicle add, profile edit
- [x] Inline server error display via DOM (no `alert()`)
- [x] Network error banner + token expiry auto-redirect

#### Commit 3 — `chore: seed data + README + v1.0.0 tag`
- [ ] `database/seed.sql`: 1 superadmin, 2 admins, 5 passengers, 5 drivers, 8 vehicles, sample trips/payments/ratings
- [ ] Final `README.md`: setup steps + test credentials per role
- [ ] E2E checklist: passenger books → driver accepts → admin reports → superadmin logs
- [ ] Git tag: `v1.0.0`

---

## 📊 30-Commit Summary Table

| Day | Commit 1 | Commit 2 | Commit 3 |
|-----|----------|----------|----------|
| 1 | Project scaffold | MySQL schema (12 tables) | Raw Node.js server + DB pool |
| 2 | Auth APIs | Public pages UI | Search-ride + route guard |
| 3 | Ride search + book APIs | Passenger dashboard + book-ride UI | Active trip + trip history UI |
| 4 | Driver availability + ride APIs | Driver dashboard + ride-requests UI | Driver active-trip + earnings UI |
| 5 | Vehicle CRUD + profile APIs | Vehicles + profile pages UI | Ratings & reviews module |
| 6 | Payments APIs | Fare rules + service area APIs | Fare-rules admin UI |
| 7 | Admin user management APIs | Admin dashboard + manage users | Manage vehicles + trips UI |
| 8 | Reports + logs APIs | Reports UI (canvas charts) | Super Admin admins + permissions |
| 9 | Super Admin dashboard + logs UI | System settings UI | Security hardening |
| 10 | Global UI polish | Form validation + error handling | Seed data + README + v1.0.0 |

---

## 🔗 Complete REST API Reference

### Auth
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register passenger or driver |
| POST | `/api/auth/login` | Public | Login → returns token |
| POST | `/api/auth/logout` | All | Invalidate session |
| GET | `/api/auth/me` | All | Current user info from token |

### Rides (Passenger)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/rides/search` | All | Search available cabs + fare estimate |
| POST | `/api/rides/book` | Passenger | Book a cab |
| GET | `/api/rides/status/:id` | Passenger | Booking/trip status |
| POST | `/api/rides/cancel/:id` | Passenger | Cancel if pending |
| GET | `/api/passenger/trips` | Passenger | Trip history |
| GET | `/api/passenger/payments` | Passenger | Payment history |
| GET | `/api/passenger/profile` | Passenger | View profile |
| PUT | `/api/passenger/profile` | Passenger | Update profile |

### Driver
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| PUT | `/api/driver/availability` | Driver | Toggle online/offline |
| GET | `/api/driver/ride-requests` | Driver | Pending ride requests |
| PUT | `/api/driver/ride-requests/:id/accept` | Driver | Accept a ride |
| PUT | `/api/driver/ride-requests/:id/reject` | Driver | Reject a ride |
| PUT | `/api/driver/trips/:id/start` | Driver | Start a trip |
| PUT | `/api/driver/trips/:id/complete` | Driver | Complete a trip |
| GET | `/api/driver/earnings` | Driver | Earnings summary |
| GET | `/api/driver/vehicles` | Driver | List vehicles |
| POST | `/api/driver/vehicles` | Driver | Add vehicle |
| PUT | `/api/driver/vehicles/:id` | Driver | Update vehicle |
| DELETE | `/api/driver/vehicles/:id` | Driver | Remove vehicle |
| GET | `/api/driver/profile` | Driver | View profile |
| PUT | `/api/driver/profile` | Driver | Update profile |

### Ratings & Payments
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/ratings` | Passenger/Driver | Submit rating |
| GET | `/api/ratings/driver/:id` | All | Driver ratings |
| GET | `/api/ratings/passenger/:id` | All | Passenger ratings |
| POST | `/api/payments` | System | Record payment |
| GET | `/api/payments/trip/:id` | Auth | Payment for a trip |

### Admin
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/passengers` | Admin | List all passengers (paginated) |
| PUT | `/api/admin/passengers/:id/block` | Admin | Block passenger |
| PUT | `/api/admin/passengers/:id/unblock` | Admin | Unblock passenger |
| GET | `/api/admin/drivers` | Admin | List all drivers |
| PUT | `/api/admin/drivers/:id/approve` | Admin | Approve driver |
| PUT | `/api/admin/drivers/:id/reject` | Admin | Reject driver |
| PUT | `/api/admin/drivers/:id/block` | Admin | Block driver |
| GET | `/api/admin/vehicles` | Admin | All vehicles |
| PUT | `/api/admin/vehicles/:id/status` | Admin | Update vehicle status |
| GET | `/api/admin/trips` | Admin | All trips (with filters) |
| PUT | `/api/admin/trips/:id/complete` | Admin | Force-complete a trip |
| GET | `/api/admin/fare-rules` | Admin | List fare rules |
| POST | `/api/admin/fare-rules` | Admin | Create fare rule |
| PUT | `/api/admin/fare-rules/:id` | Admin | Update fare rule |
| DELETE | `/api/admin/fare-rules/:id` | Admin | Delete fare rule |
| GET | `/api/admin/service-areas` | Admin | List service areas |
| POST | `/api/admin/service-areas` | Admin | Create service area |
| PUT | `/api/admin/service-areas/:id` | Admin | Update service area |
| DELETE | `/api/admin/service-areas/:id` | Admin | Delete service area |
| GET | `/api/admin/reports/revenue` | Admin | Revenue report |
| GET | `/api/admin/reports/trips` | Admin | Trip statistics |
| GET | `/api/admin/reports/drivers` | Admin | Driver performance |

### Super Admin
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/superadmin/admins` | Super Admin | List admins |
| POST | `/api/superadmin/admins` | Super Admin | Create admin |
| PUT | `/api/superadmin/admins/:id` | Super Admin | Update admin |
| DELETE | `/api/superadmin/admins/:id` | Super Admin | Delete admin |
| PUT | `/api/superadmin/admins/:id/activate` | Super Admin | Activate admin |
| PUT | `/api/superadmin/admins/:id/deactivate` | Super Admin | Deactivate admin |
| GET | `/api/superadmin/permissions/:id` | Super Admin | Get admin permissions |
| POST | `/api/superadmin/permissions/:id` | Super Admin | Add permission |
| DELETE | `/api/superadmin/permissions/:id` | Super Admin | Remove permission |
| GET | `/api/superadmin/logs` | Super Admin | Filtered system logs |
| GET | `/api/superadmin/settings` | Super Admin | Get system settings |
| PUT | `/api/superadmin/settings` | Super Admin | Update system settings |

---

## 🗄️ Database Schema Quick Reference

| Table | Key Fields |
|-------|-----------|
| `users` | user_id, name, email, password, mobile, **role** (passenger/driver/admin/superadmin), status, created_at |
| `passenger_profiles` | passenger_id, user_id, default_address, emergency_contact |
| `driver_profiles` | driver_id, user_id, license_no, license_expiry, **verification_status**, rating |
| `vehicles` | vehicle_id, driver_id, vehicle_number, **vehicle_type**, model, capacity, status |
| `service_areas` | area_id, area_name, city, state, status |
| `fare_rules` | fare_id, vehicle_type, base_fare, per_km_rate, per_minute_rate, cancellation_fee, status |
| `ride_requests` | request_id, passenger_id, pickup_location, destination, requested_at, estimated_fare, **status** |
| `trips` | trip_id, request_id, passenger_id, driver_id, vehicle_id, start_time, end_time, distance_km, fare, **trip_status** |
| `payments` | payment_id, trip_id, passenger_id, amount, payment_method, **payment_status**, paid_at |
| `ratings_reviews` | review_id, trip_id, reviewer_id, reviewed_user_id, rating, comment, created_at |
| `admin_permissions` | permission_id, admin_id, permission_name |
| `system_logs` | log_id, user_id, action, description, ip_address, created_at |

---

## ⚠️ Technical Constraints (STRICTLY ENFORCED)

| Constraint | Rule |
|-----------|------|
| **No Express.js** | Use Node `http` module + custom `router.js` |
| **No React/Vue/Angular** | Pure vanilla JS + DOM manipulation only |
| **No Chart.js/D3** | Use HTML5 `<canvas>` API for all charts |
| **No axios/jQuery** | Use `fetch()` API only |
| **Auth tokens** | `crypto.createHmac('sha256', SECRET)` for token signing, stored in `sessionStorage` |
| **DB Queries** | Always use `?` parameterized queries (prevent SQL injection) |
| **Static files** | Served via `fs.readFile` in `server.js` based on URL path |

---

## 🎨 Design System Tokens

```css
/* Color Palette */
--primary:    hsl(220, 80%, 55%);   /* vibrant blue */
--accent:     hsl(38, 95%, 55%);    /* taxi amber/yellow */
--bg:         hsl(220, 15%, 10%);   /* dark background */
--surface:    hsl(220, 15%, 16%);   /* card surface */
--border:     hsl(220, 15%, 24%);   /* subtle border */
--text:       hsl(220, 15%, 92%);   /* primary text */
--text-muted: hsl(220, 10%, 60%);   /* secondary text */
--success:    hsl(142, 70%, 45%);
--error:      hsl(0, 75%, 55%);
--warning:    hsl(38, 95%, 55%);

/* Typography */
--font-ui:      'Inter', sans-serif;
--font-heading: 'Outfit', sans-serif;

/* Effects */
--glass-bg:  rgba(255,255,255,0.05);
--blur:      backdrop-filter: blur(12px);
--radius:    12px;
--shadow:    0 4px 24px rgba(0,0,0,0.4);
```

---

## 🚀 Local Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd cab-booking

# 2. Install dependencies (only mysql2 allowed)
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Create the database
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql

# 5. Start the server
node server/server.js

# 6. Open browser
# http://localhost:3000
```

### 🔑 Test Credentials (after seed.sql)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@cab.com | SuperAdmin@123 |
| Admin | admin@cab.com | Admin@123 |
| Driver | driver1@cab.com | Driver@123 |
| Passenger | passenger1@cab.com | Pass@123 |

---

## 📋 Role-Based Permissions

| Feature | Passenger | Driver | Admin | Super Admin |
|---------|-----------|--------|-------|-------------|
| Register | ✅ | ✅ | ❌ | ❌ |
| Login | ✅ | ✅ | ✅ | ✅ |
| Book a cab | ✅ | ❌ | ❌ | ❌ |
| Cancel own booking | ✅ | ❌ | ❌ | ❌ |
| View own trip history | ✅ | ✅ | ❌ | ❌ |
| Set driver availability | ❌ | ✅ | ❌ | ❌ |
| Accept/reject ride | ❌ | ✅ | ❌ | ❌ |
| Start/complete trip | ❌ | ✅ | ✅ | ✅ |
| Manage own vehicles | ❌ | ✅ | ❌ | ❌ |
| Manage all vehicles | ❌ | ❌ | ✅ | ✅ |
| Manage drivers | ❌ | ❌ | ✅ | ✅ |
| Manage passengers | ❌ | ❌ | ✅ | ✅ |
| Manage fares/areas | ❌ | ❌ | ✅ | ✅ |
| View reports | Own trips | Own trips | ✅ | ✅ |
| Block/unblock users | ❌ | ❌ | ✅ | ✅ |
| Create/delete admins | ❌ | ❌ | ❌ | ✅ |
| Manage permissions | ❌ | ❌ | ❌ | ✅ |
| System logs/settings | ❌ | ❌ | Limited | ✅ |

---

*Last updated: 2026-10-19 | Day 1 of 10*
