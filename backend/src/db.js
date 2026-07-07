const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString =
  process.env.DATABASE_URL || 'postgres://parking:parking@localhost:5432/parking';

const pool = new Pool({
  connectionString,
  // managed Postgres providers (Neon, Supabase, RDS, ...) require TLS
  ssl: /sslmode=require|neon\.tech|supabase\.co|render\.com/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
  // keep the pool small in serverless environments — each instance gets its own pool
  max: process.env.VERCEL ? 3 : 10,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  grid_width INT NOT NULL DEFAULT 14 CHECK (grid_width BETWEEN 2 AND 60),
  grid_height INT NOT NULL DEFAULT 8 CHECK (grid_height BETWEEN 2 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floor_cells (
  id SERIAL PRIMARY KEY,
  floor_id INT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  x INT NOT NULL,
  y INT NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  orientation TEXT,
  UNIQUE (floor_id, x, y)
);

-- idempotent migration: newer cell types + 2-square orientation for spots
ALTER TABLE floor_cells ADD COLUMN IF NOT EXISTS orientation TEXT;
ALTER TABLE floor_cells DROP CONSTRAINT IF EXISTS floor_cells_type_check;
ALTER TABLE floor_cells ADD CONSTRAINT floor_cells_type_check
  CHECK (type IN ('wall', 'spot', 'blocked', 'elevator', 'stairs', 'entrance'));
ALTER TABLE floor_cells DROP CONSTRAINT IF EXISTS floor_cells_orientation_check;
ALTER TABLE floor_cells ADD CONSTRAINT floor_cells_orientation_check
  CHECK (orientation IS NULL OR orientation IN ('h', 'v'));

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  cell_id INT NOT NULL REFERENCES floor_cells(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS one_booking_per_spot_day
  ON bookings (cell_id, date) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS one_booking_per_user_day
  ON bookings (user_id, date) WHERE status = 'active';
`;

async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error('Database not reachable');
}

async function seed() {
  const { rows: userCount } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (userCount[0].n === 0) {
    await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES
       ($1, $2, $3, $4, 'admin'),
       ($5, $6, $7, $8, 'user')`,
      [
        'Admin', 'admin@company.com', '+33100000001', bcrypt.hashSync('admin123', 10),
        'Demo User', 'user@company.com', '+33100000002', bcrypt.hashSync('user123', 10),
      ]
    );
    console.log('Seeded users: admin@company.com/admin123, user@company.com/user123');
  }

  const { rows: floorCount } = await pool.query('SELECT COUNT(*)::int AS n FROM floors');
  if (floorCount[0].n === 0) {
    const { rows } = await pool.query(
      `INSERT INTO floors (name, grid_width, grid_height) VALUES ('Level 1', 14, 10) RETURNING id`
    );
    const floorId = rows[0].id;
    const cells = []; // [x, y, type, label, orientation]
    // perimeter walls, with a gap for the entrance at (13,5)
    for (let x = 0; x < 14; x++) {
      cells.push([x, 0, 'wall', null, null]);
      cells.push([x, 9, 'wall', null, null]);
    }
    for (let y = 1; y < 9; y++) {
      cells.push([0, y, 'wall', null, null]);
      if (y !== 5) cells.push([13, y, 'wall', null, null]);
    }
    cells.push([13, 5, 'entrance', null, null]);
    cells.push([1, 4, 'elevator', null, null]);
    cells.push([1, 5, 'stairs', null, null]);
    // two rows of vertical 2-square spots, last of each row blocked
    for (let x = 2; x <= 11; x++) {
      cells.push([x, 1, x === 11 ? 'blocked' : 'spot', x === 11 ? null : `A${x - 1}`, 'v']);
      cells.push([x, 7, x === 11 ? 'blocked' : 'spot', x === 11 ? null : `B${x - 1}`, 'v']);
    }
    for (const [x, y, type, label, orientation] of cells) {
      await pool.query(
        'INSERT INTO floor_cells (floor_id, x, y, type, label, orientation) VALUES ($1, $2, $3, $4, $5, $6)',
        [floorId, x, y, type, label, orientation]
      );
    }
    console.log('Seeded sample floor "Level 1"');
  }
}

async function init() {
  await waitForDb();
  await pool.query(SCHEMA);
  await seed();
}

module.exports = { pool, init };
