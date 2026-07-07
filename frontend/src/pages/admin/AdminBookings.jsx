import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (status) params.set('status', status);
    api
      .get(`/admin/bookings?${params}`)
      .then((d) => setBookings(d.bookings))
      .catch((e) => setError(e.message));
  };

  useEffect(load, [date, status]);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setError('');
    try {
      await api.del(`/bookings/${id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <h2>All bookings</h2>
        <div className="toolbar-controls">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {date && (
            <button className="btn btn-ghost" onClick={() => setDate('')}>
              Clear date
            </button>
          )}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th><th>Floor</th><th>Spot</th><th>User</th><th>Contact</th><th>Status</th><th />
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.date}</td>
              <td>{b.floor_name}</td>
              <td><strong>{b.spot_label || '—'}</strong></td>
              <td>
                {b.user_name}
                <div className="muted small">{b.user_email}</div>
              </td>
              <td>{b.user_phone}</td>
              <td>
                <span className={b.status === 'active' ? 'pill pill-green' : 'pill pill-red'}>
                  {b.status}
                </span>
              </td>
              <td>
                {b.status === 'active' && (
                  <button className="btn btn-danger btn-sm" onClick={() => cancel(b.id)}>
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
          {bookings.length === 0 && (
            <tr>
              <td colSpan="7" className="muted">No bookings match the filters.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
