const express = require('express');
const { pool } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

const VALID_TYPES = ['wall', 'spot', 'blocked', 'elevator', 'stairs', 'entrance'];
// spots and blocked spots occupy 2 grid squares (orientation 'h' or 'v')
const SPAN_TYPES = ['spot', 'blocked'];

function footprint(c) {
  const squares = [[c.x, c.y]];
  if (c.orientation === 'h') squares.push([c.x + 1, c.y]);
  if (c.orientation === 'v') squares.push([c.x, c.y + 1]);
  return squares;
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

router.get('/', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, COUNT(c.id) FILTER (WHERE c.type = 'spot')::int AS spot_count
       FROM floors f LEFT JOIN floor_cells c ON c.floor_id = f.id
       GROUP BY f.id ORDER BY f.id`
    );
    res.json({ floors: rows });
  } catch (err) {
    next(err);
  }
});

// Floor detail: layout cells + active bookings for the given date
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const floorId = Number(req.params.id);
    const date = isValidDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);

    const { rows: floors } = await pool.query('SELECT * FROM floors WHERE id = $1', [floorId]);
    if (!floors[0]) return res.status(404).json({ error: 'Floor not found' });

    const { rows: cells } = await pool.query(
      'SELECT id, x, y, type, label, orientation FROM floor_cells WHERE floor_id = $1 ORDER BY y, x',
      [floorId]
    );

    const { rows: bookings } = await pool.query(
      `SELECT b.id, b.cell_id, b.user_id, u.name AS user_name, u.phone AS user_phone
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN floor_cells c ON c.id = b.cell_id
       WHERE c.floor_id = $1 AND b.date = $2 AND b.status = 'active'`,
      [floorId, date]
    );

    res.json({
      floor: floors[0],
      date,
      cells,
      bookings: bookings.map((b) => ({
        id: b.id,
        cellId: b.cell_id,
        userName: b.user_name,
        userPhone: b.user_phone,
        mine: b.user_id === req.user.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', adminRequired, async (req, res, next) => {
  try {
    const { name, grid_width, grid_height } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Floor name is required' });
    const w = Math.min(Math.max(Number(grid_width) || 14, 2), 60);
    const h = Math.min(Math.max(Number(grid_height) || 8, 2), 60);
    const { rows } = await pool.query(
      'INSERT INTO floors (name, grid_width, grid_height) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), w, h]
    );
    res.status(201).json({ floor: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', adminRequired, async (req, res, next) => {
  try {
    const floorId = Number(req.params.id);
    const { name, grid_width, grid_height } = req.body || {};
    const { rows: existing } = await pool.query('SELECT * FROM floors WHERE id = $1', [floorId]);
    if (!existing[0]) return res.status(404).json({ error: 'Floor not found' });
    const w = Math.min(Math.max(Number(grid_width) || existing[0].grid_width, 2), 60);
    const h = Math.min(Math.max(Number(grid_height) || existing[0].grid_height, 2), 60);
    const { rows } = await pool.query(
      'UPDATE floors SET name = $1, grid_width = $2, grid_height = $3 WHERE id = $4 RETURNING *',
      [(name || existing[0].name).trim(), w, h, floorId]
    );
    // drop cells whose footprint fell out of bounds after a resize
    await pool.query(
      `DELETE FROM floor_cells
       WHERE floor_id = $1
         AND (x >= $2 OR y >= $3
              OR (orientation = 'h' AND x + 1 >= $2)
              OR (orientation = 'v' AND y + 1 >= $3))`,
      [floorId, w, h]
    );
    res.json({ floor: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Replace the full layout of a floor
router.put('/:id/cells', adminRequired, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const floorId = Number(req.params.id);
    const { cells } = req.body || {};
    if (!Array.isArray(cells)) return res.status(400).json({ error: 'cells must be an array' });

    const { rows: floors } = await pool.query('SELECT * FROM floors WHERE id = $1', [floorId]);
    const floor = floors[0];
    if (!floor) return res.status(404).json({ error: 'Floor not found' });

    const occupied = new Set();
    for (const c of cells) {
      if (
        !Number.isInteger(c.x) || !Number.isInteger(c.y) ||
        c.x < 0 || c.y < 0 ||
        !VALID_TYPES.includes(c.type)
      ) {
        return res.status(400).json({ error: `Invalid cell at (${c.x}, ${c.y})` });
      }
      c.orientation =
        SPAN_TYPES.includes(c.type) && (c.orientation === 'h' || c.orientation === 'v')
          ? c.orientation
          : null;
      for (const [sx, sy] of footprint(c)) {
        if (sx >= floor.grid_width || sy >= floor.grid_height) {
          return res.status(400).json({ error: `Cell at (${c.x}, ${c.y}) extends outside the grid` });
        }
        const key = `${sx},${sy}`;
        if (occupied.has(key)) {
          return res.status(400).json({ error: `Overlapping cells at (${sx}, ${sy})` });
        }
        occupied.add(key);
      }
    }

    await client.query('BEGIN');

    const keep = cells.map((c) => `${c.x},${c.y}`);
    const { rows: existing } = await client.query(
      'SELECT id, x, y FROM floor_cells WHERE floor_id = $1',
      [floorId]
    );
    const toDelete = existing.filter((e) => !keep.includes(`${e.x},${e.y}`)).map((e) => e.id);
    if (toDelete.length) {
      await client.query('DELETE FROM floor_cells WHERE id = ANY($1)', [toDelete]);
    }

    for (const c of cells) {
      await client.query(
        `INSERT INTO floor_cells (floor_id, x, y, type, label, orientation)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (floor_id, x, y) DO UPDATE
           SET type = EXCLUDED.type, label = EXCLUDED.label, orientation = EXCLUDED.orientation`,
        [floorId, c.x, c.y, c.type, c.type === 'spot' ? c.label || null : null, c.orientation]
      );
    }

    // cancel upcoming bookings on cells that are no longer bookable spots
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = now()
       WHERE status = 'active' AND date >= CURRENT_DATE
         AND cell_id IN (SELECT id FROM floor_cells WHERE floor_id = $1 AND type <> 'spot')`,
      [floorId]
    );

    await client.query('COMMIT');

    const { rows: saved } = await pool.query(
      'SELECT id, x, y, type, label, orientation FROM floor_cells WHERE floor_id = $1 ORDER BY y, x',
      [floorId]
    );
    res.json({ cells: saved });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM floors WHERE id = $1', [Number(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'Floor not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
