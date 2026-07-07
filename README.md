# Company Parking Manager

Full-stack app to manage the company parking infrastructure.

- **Frontend:** React (Vite), served by nginx
- **Backend:** Node.js / Express REST API
- **Database:** PostgreSQL
- Everything is dockerised via `docker-compose`.

## Run it

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

Seeded accounts:

| Role  | Email               | Password |
|-------|---------------------|----------|
| Admin | admin@company.com   | admin123 |
| User  | user@company.com    | user123  |

A sample floor ("Level 1") with walls, spots and blocked spots is seeded automatically.

## Roles

- **Guest** — only sees the login / registration page.
- **User** — sees the floor map with live availability for a chosen date, books a spot
  (one spot per person per day, one person per spot per day), cancels their bookings,
  and can click an occupied spot to **call the person parked there** (e.g. if blocked in).
- **Admin** — everything a user can do, plus:
  - **Floor Designer**: create floors and paint the map on a grid — walls, bookable
    spots, blocked spots, elevators, stairs, and parking entrances. Spots and blocked
    spots occupy **2 grid squares** (pick vertical ↕ or horizontal ↔ direction).
    Click/drag or touch-drag to paint, double-click a spot to rename it.
    Unnamed spots are auto-labelled on save. Overlaps and out-of-grid placements
    are rejected server-side.
  - **All Bookings**: view/filter every booking and cancel any of them.
  - **Metrics**: global stats and a per-user breakdown (total / upcoming / past /
    cancelled bookings, last booking date).

## Architecture

```
frontend (nginx :8080) ──/api──▶ backend (express :4000) ──▶ db (postgres :5432)
```

- The backend creates the schema and seeds demo data on first start.
- Auth is JWT-based (12h expiry). Passwords hashed with bcrypt.
- Booking integrity is enforced with partial unique indexes
  (`one active booking per spot per day`, `one active booking per user per day`).
- Editing a floor layout cancels upcoming bookings on spots that were removed or blocked.

## Local development (without Docker)

```bash
# database: any local postgres, e.g.
docker run -d -p 5432:5432 -e POSTGRES_USER=parking -e POSTGRES_PASSWORD=parking -e POSTGRES_DB=parking postgres:16-alpine

# backend
cd backend && npm install && npm start          # http://localhost:4000

# frontend (proxies /api to :4000)
cd frontend && npm install && npm run dev       # http://localhost:5173
```

## Deploy to Vercel (with a GoDaddy domain)

Vercel serves `frontend/dist` as static files and runs the Express API as a
serverless function ([api/index.js](api/index.js)). Postgres must live on a managed
provider — Neon's free tier works well and is available in the Vercel Marketplace.

1. **Database** — create a Postgres database on [Neon](https://neon.tech)
   (or Vercel Marketplace → Storage → Neon). Copy the connection string
   (`postgres://...@...neon.tech/...?sslmode=require`).
2. **Import the repo** — on [vercel.com](https://vercel.com) → *Add New → Project*
   → import `parking-app` from GitHub. Framework preset: **Other** (the included
   `vercel.json` drives the build).
3. **Environment variables** — in the project settings add:
   - `DATABASE_URL` = the Neon connection string
   - `JWT_SECRET` = a long random string (e.g. output of `openssl rand -hex 32`)
4. **Deploy** — the first request creates the schema and seeds the demo accounts
   and sample floor. Check `https://<project>.vercel.app/api/health`.
   ⚠️ Change the seeded admin password immediately on a public deployment.
5. **GoDaddy domain** — in Vercel: *Project → Settings → Domains → Add* your domain.
   Then in GoDaddy: *My Products → DNS* for the domain and add what Vercel shows you,
   typically:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value `cname.vercel-dns.com`
   Remove GoDaddy's default "Parked" A record if present. DNS can take up to an
   hour; Vercel issues the HTTPS certificate automatically once it verifies.

Notes: the Docker setup keeps working unchanged for local dev
(`backend/src/index.js` is the long-running entrypoint; Vercel uses
`api/index.js`). On serverless, schema/seed checks run once per cold start.

## Configuration

| Variable       | Where    | Default                                   |
|----------------|----------|-------------------------------------------|
| `DATABASE_URL` | backend  | `postgres://parking:parking@db:5432/parking` |
| `JWT_SECRET`   | backend  | `change-me-in-production` (set a real secret!) |
| `PORT`         | backend  | `4000`                                    |
