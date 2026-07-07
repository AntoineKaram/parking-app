const express = require('express');
const { pool } = require('../db');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/bookings', adminRequired, async (req, res, next) => {
  try {
    const { date, status } = req.query;
    const params = [];
    const where = [];
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.push(date);
      where.push(`b.date = $${params.length}`);
    }
    if (status === 'active' || status === 'cancelled') {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }
    const { rows } = await pool.query(
      `SELECT b.id, b.date::text, b.status, b.created_at, b.cancelled_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
              c.label AS spot_label, f.name AS floor_name
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN floor_cells c ON c.id = b.cell_id
       JOIN floors f ON f.id = c.floor_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY b.date DESC, b.created_at DESC
       LIMIT 300`,
      params
    );
    res.json({ bookings: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/metrics', adminRequired, async (req, res, next) => {
  try {
    const { rows: perUser } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role,
              COUNT(b.id)::int AS total_bookings,
              COUNT(b.id) FILTER (WHERE b.status = 'active' AND b.date >= CURRENT_DATE)::int AS upcoming,
              COUNT(b.id) FILTER (WHERE b.status = 'active' AND b.date < CURRENT_DATE)::int AS past,
              COUNT(b.id) FILTER (WHERE b.status = 'cancelled')::int AS cancelled,
              MAX(b.date) FILTER (WHERE b.status = 'active')::text AS last_booking
       FROM users u
       LEFT JOIN bookings b ON b.user_id = u.id
       GROUP BY u.id
       ORDER BY total_bookings DESC, u.name`
    );
    const { rows: totals } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM floor_cells WHERE type = 'spot') AS total_spots,
         (SELECT COUNT(*)::int FROM bookings WHERE status = 'active' AND date = CURRENT_DATE) AS booked_today,
         (SELECT COUNT(*)::int FROM users) AS total_users`
    );
    res.json({ users: perUser, totals: totals[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
