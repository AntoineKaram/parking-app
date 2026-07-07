const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.date::text, b.status, b.created_at,
              c.label AS spot_label, f.name AS floor_name, f.id AS floor_id
       FROM bookings b
       JOIN floor_cells c ON c.id = b.cell_id
       JOIN floors f ON f.id = c.floor_id
       WHERE b.user_id = $1 AND b.status = 'active'
       ORDER BY b.date DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ bookings: rows, today: todayStr() });
  } catch (err) {
    next(err);
  }
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const { cellId, date } = req.body || {};
    if (!cellId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'cellId and date (YYYY-MM-DD) are required' });
    }
    if (date < todayStr()) {
      return res.status(400).json({ error: 'Cannot book a date in the past' });
    }
    const { rows: cells } = await pool.query('SELECT * FROM floor_cells WHERE id = $1', [cellId]);
    if (!cells[0]) return res.status(404).json({ error: 'Spot not found' });
    if (cells[0].type !== 'spot') {
      return res.status(400).json({ error: 'This location is not a bookable spot' });
    }
    const { rows } = await pool.query(
      `INSERT INTO bookings (cell_id, user_id, date) VALUES ($1, $2, $3) RETURNING id, date::text`,
      [cellId, req.user.id, date]
    );
    res.status(201).json({ booking: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      const msg = (err.constraint || '').includes('user')
        ? 'You already have a booking for that day'
        : 'This spot is already booked for that day';
      return res.status(409).json({ error: msg });
    }
    next(err);
  }
});

router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only cancel your own bookings' });
    }
    if (booking.status !== 'active') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }
    await pool.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
