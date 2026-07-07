import { useEffect, useState } from 'react';
import { api } from '../api';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [today, setToday] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api
      .get('/bookings/me')
      .then((d) => {
        setBookings(d.bookings);
        setToday(d.today);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const cancel = async (id) => {
    setError('');
    try {
      await api.del(`/bookings/${id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const upcoming = bookings.filter((b) => b.date >= today);
  const past = bookings.filter((b) => b.date < today);

  const row = (b, cancellable) => (
    <tr key={b.id}>
      <td>{b.date}</td>
      <td>{b.floor_name}</td>
      <td>
        <strong>{b.spot_label || '—'}</strong>
      </td>
      <td>
        {cancellable && (
          <button className="btn btn-danger btn-sm" onClick={() => cancel(b.id)}>
            Cancel
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <h2>My bookings</h2>
      {error && <div className="error">{error}</div>}

      <h3>Upcoming</h3>
      {upcoming.length === 0 ? (
        <p className="muted">No upcoming bookings. Head to the Parking Map to book a spot.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Floor</th><th>Spot</th><th /></tr>
            </thead>
            <tbody>{upcoming.map((b) => row(b, true))}</tbody>
          </table>
        </div>
      )}

      <h3>Past</h3>
      {past.length === 0 ? (
        <p className="muted">No past bookings.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Floor</th><th>Spot</th><th /></tr>
            </thead>
            <tbody>{past.map((b) => row(b, false))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
