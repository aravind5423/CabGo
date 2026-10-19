# 🚖 Online Cab Booking System

Web Technology CIA Assignment – Online Cab Booking System

## Tech Stack
- **Frontend**: HTML, CSS, Vanilla JavaScript, DOM, AJAX/Fetch
- **Backend**: Node.js (built-in modules only – no Express)
- **Database**: MySQL

> ❌ No React, Angular, Vue, Express.js, or any web framework used.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 3. Initialize database
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql

# 4. Start server
npm start

# 5. Open http://localhost:3000
```

## Test Credentials (after seed.sql)
| Role        | Email                  | Password      |
|-------------|------------------------|---------------|
| Super Admin | superadmin@cab.com     | SuperAdmin@123|
| Admin       | admin@cab.com          | Admin@123     |
| Driver      | driver1@cab.com        | Driver@123    |
| Passenger   | passenger1@cab.com     | Pass@123      |

## Project Plan
See [TEAM_PLAN.md](./TEAM_PLAN.md) for the full 10-day plan with commit checklist.
