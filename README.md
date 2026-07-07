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

## Configuration

| Variable       | Where    | Default                                   |
|----------------|----------|-------------------------------------------|
| `DATABASE_URL` | backend  | `postgres://parking:parking@db:5432/parking` |
| `JWT_SECRET`   | backend  | `change-me-in-production` (set a real secret!) |
| `PORT`         | backend  | `4000`                                    |
