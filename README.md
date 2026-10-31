# 🚖 CabGo — Online Cab Booking System

> **Web Technology CIA Assignment**  
> **Tech Stack**: HTML5 · CSS3 (Vanilla) · Vanilla JavaScript · DOM Manipulation · Fetch API · Node.js (Built-in HTTP & Crypto Modules Only) · MySQL  
> **Strict Constraint**: ❌ No React, Angular, Vue, Express.js, or any web framework used.

> 🚀 **Production Modernization In Progress**: See [PRODUCTION_MIGRATION_PLAN.md](PRODUCTION_MIGRATION_PLAN.md) for the master blueprint, [TEAM_PLAN.md](TEAM_PLAN.md) for sprint milestones, and [TEAMMATE_KICKOFF.md](TEAMMATE_KICKOFF.md) for Teammate A & B Day-1 setup instructions.

---

## 🌟 Overview

**CabGo** is a full-featured, multi-tenant urban transit dispatch and cab booking web platform built entirely from first principles using Vanilla JavaScript and Node.js built-in modules.

It features 4 distinct role-based portals:
1. **Passenger**: Instant fare quotes, cab booking, real-time trip polling, history & receipts, rating submissions.
2. **Driver Partner**: Online/offline toggle, dispatch request accept/reject, active trip navigation console, fleet vehicle management, daily earnings.
3. **Operations Admin**: User moderation (block/unblock), driver approvals, vehicle fleet audits, trip lifecycle overrides, fare rule matrix, canvas analytics & CSV export.
4. **Super Admin**: Executive telemetry, admin provisioning, fine-grained RBAC permissions, platform policies (commission, cancellation caps, maintenance mode), and immutable chronological compliance audit trail.

---

## 🚀 Quick Setup & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MySQL**: v8.0 or higher (Local MySQL or TiDB Cloud Serverless)

### 2. Clone and Install Dependencies
```bash
git clone <repository-url>
cd cab-booking
npm install
```
*(Uses raw SQL pooling via `mysql2` and `@tidbcloud/serverless`; zero heavy web frameworks or UI libraries).*

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update your database credentials in `.env`:
```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cab_booking

# Optional: direct TiDB or cloud database connection URL
# DATABASE_URL=mysql://<user>:<password>@<host>:<port>/<database>?ssl=true

SERVER_PORT=5000
TOKEN_SECRET=your_super_secret_hmac_key_min_32_chars
```

### 4. Database Setup & Seeding

**Option A — TiDB Cloud / Serverless (Automated):**
```bash
npm run db:setup
```

**Option B — Local MySQL:**
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 5. Start the Server
```bash
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 🔑 Test Credentials (Pre-seeded)

All passwords are securely hashed using Node.js built-in `crypto.pbkdf2Sync` (10,000 iterations, SHA-512):

| Role | Name | Email | Password |
|---|---|---|---|
| **Super Admin** | Super Administrator | `superadmin@cab.com` | `SuperAdmin@123` |
| **Admin 1** | Operations Admin | `admin@cab.com` | `Admin@123` |
| **Admin 2** | Fleet Supervisor Admin | `admin2@cab.com` | `Admin@123` |
| **Driver 1** | Rajesh Kumar (Sedan) | `driver1@cab.com` | `Driver@123` |
| **Driver 2** | Suresh Sharma (SUV) | `driver2@cab.com` | `Driver@123` |
| **Driver 3** | Karthik Varma (Hatchback) | `driver3@cab.com` | `Driver@123` |
| **Driver 4** | Anand Prakash (Auto) | `driver4@cab.com` | `Driver@123` |
| **Driver 5** | Manoj Selvam (Bike) | `driver5@cab.com` | `Driver@123` |
| **Passenger 1** | Aravind Passenger | `passenger1@cab.com` | `Pass@123` |
| **Passenger 2** | Priya Mohan | `passenger2@cab.com` | `Pass@123` |
| **Passenger 3** | Rahul Dravid | `passenger3@cab.com` | `Pass@123` |
| **Passenger 4** | Sneha Reddy | `passenger4@cab.com` | `Pass@123` |
| **Passenger 5** | Vikram Seth | `passenger5@cab.com` | `Pass@123` |

---

## 🧪 End-to-End (E2E) Verification Checklist

Follow this workflow to test the entire lifecycle:

- [x] **Step 1: Passenger Ride Booking**
  - Sign in as `passenger1@cab.com` (`Pass@123`).
  - Navigate to **Book Ride** (`/passenger/book-ride.html`).
  - Select pickup location and destination.
  - Choose vehicle tier (`Sedan`, `SUV`, `Hatchback`, etc.) to see live fare estimate.
  - Click **Request Ride Now** &mdash; request enters `pending` status.
- [x] **Step 2: Driver Acceptance & Trip Execution**
  - Sign in as `driver1@cab.com` (`Driver@123`) in another browser or incognito window.
  - Verify driver availability is set to **Online**.
  - Navigate to **Incoming Requests** (`/driver/ride-requests.html`) and click **Accept**.
  - Head to **Active Trip** (`/driver/active-trip.html`), click **Start Trip**, and subsequently **Complete Trip**.
- [x] **Step 3: Automated Payment & Rating Feedback**
  - Passenger active trip polling detects completion and prompts the 5-star rating modal.
  - Passenger submits a rating and feedback comment &mdash; stored in `ratings_reviews` table.
  - Payment is recorded automatically in `payments` with method (`wallet`, `card`, `upi`).
- [x] **Step 4: Operations Administration & Analytics**
  - Sign in as `admin@cab.com` (`Admin@123`).
  - View fleet KPIs and Canvas bar charts on **Dashboard** (`/admin/dashboard.html`).
  - Inspect financial analytics and download CSV in **Reports** (`/admin/reports.html`).
  - Manage passenger accounts, driver credentials, and fleet vehicles.
- [x] **Step 5: Super Admin Executive Governance & Audit Trail**
  - Sign in as `superadmin@cab.com` (`SuperAdmin@123`).
  - Verify platform health, global settings (`/superadmin/system-settings.html`), and RBAC matrix (`/superadmin/permissions.html`).
  - Review immutable chronological logs in **System Logs** (`/superadmin/system-logs.html`).

---

## 📁 Project Architecture

```
cab-booking/
├── server/
│   ├── server.js                     # Raw Node http.createServer + static file router
│   ├── router.js                     # Lightweight regex URL dispatcher
│   ├── db.js                         # MySQL2 connection pool with .env loader
│   ├── middleware/
│   │   ├── auth.js                   # HMAC-SHA256 session token encoder & guard
│   │   ├── logger.js                 # Automatic audit logging into system_logs
│   │   └── rateLimit.js              # In-memory sliding window rate limiter
│   ├── routes/
│   │   ├── auth.js                   # Register, login, logout, /me
│   │   ├── passenger.js              # Booking, trip status, history, profile
│   │   ├── driver.js                 # Availability, accept/reject, trip lifecycle, earnings
│   │   ├── admin.js                  # User moderation, fleet audits, reports, fare rules
│   │   └── superadmin.js             # Admin management, permissions, logs, settings
│   └── utils/
│       └── fareCalculator.js         # Distance & tariff calculation logic
├── public/
│   ├── index.html                    # Public landing page (Ronas IT Zen aesthetic)
│   ├── login.html                    # Authentication login console
│   ├── register.html                 # Passenger & driver registration
│   ├── search-ride.html              # Public ride search & upfront fare calculator
│   ├── passenger/                    # Passenger dashboard & booking flows
│   ├── driver/                       # Driver console, fleet, & earnings
│   ├── admin/                        # Operations admin suite & analytics
│   ├── superadmin/                   # Super Admin governance & audit trails
│   ├── css/
│   │   ├── global.css                # Color tokens, typography, dark mode base
│   │   ├── auth.css                  # Login & registration styling
│   │   ├── dashboard.css             # Dashboard shell, navbar, responsive drawer
│   │   └── components.css            # Toasts, modals, tables, badges, skeletons
│   └── js/
│       ├── api.js                    # Fetch wrapper, theme toggle, drawer & toasts
│       ├── auth.js                   # Login & registration logic
│       ├── validator.js              # Client-side input validation suite
│       └── router-guard.js           # Client-side role authorization guard
├── database/
│   ├── schema.sql                    # 12 relational tables with foreign keys
│   └── seed.sql                      # Demo seed dataset
├── package.json
├── TEAM_PLAN.md                      # Complete 10-day execution checklist
└── README.md                         # Documentation & test runbook
```

---

## 🏷️ Version Release

- **Version**: `v1.0.0`
- **Cadence**: 30 structured commits completed over 10 project milestones.
- **Assignment**: Web Technology CIA Project.
