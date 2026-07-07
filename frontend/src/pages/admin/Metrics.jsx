import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function Metrics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/metrics').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <h2>Metrics</h2>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{data.totals.total_spots}</div>
          <div className="stat-label">Total spots</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.totals.booked_today}</div>
          <div className="stat-label">Booked today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.totals.total_users}</div>
          <div className="stat-label">Registered users</div>
        </div>
      </div>

      <h3>Per user</h3>
      <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>User</th><th>Role</th><th>Total</th><th>Upcoming</th><th>Past</th><th>Cancelled</th><th>Last booking</th>
          </tr>
        </thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                <div className="muted small">{u.email}</div>
              </td>
              <td>{u.role}</td>
              <td><strong>{u.total_bookings}</strong></td>
              <td>{u.upcoming}</td>
              <td>{u.past}</td>
              <td>{u.cancelled}</td>
              <td>{u.last_booking || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
