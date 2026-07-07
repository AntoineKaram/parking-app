import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import FloorGrid from '../components/FloorGrid';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ParkingView() {
  const [floors, setFloors] = useState([]);
  const [floorId, setFloorId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // {cell, booking}
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cellSize, setCellSize] = useState(() => (window.innerWidth < 640 ? 32 : 44));

  useEffect(() => {
    api
      .get('/floors')
      .then((d) => {
        setFloors(d.floors);
        if (d.floors.length && floorId == null) setFloorId(d.floors[0].id);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    if (floorId == null) return;
    api
      .get(`/floors/${floorId}?date=${date}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [floorId, date]);

  useEffect(load, [load]);

  const bookingsByCell = {};
  if (data) for (const b of data.bookings) bookingsByCell[b.cellId] = b;

  const isPast = date < todayStr();

  const onCellClick = (x, y, cell) => {
    if (!cell || cell.type !== 'spot') return;
    const booking = bookingsByCell[cell.id];
    setModal({ cell, booking });
  };

  const book = async () => {
    setError('');
    setNotice('');
    try {
      await api.post('/bookings', { cellId: modal.cell.id, date });
      setNotice(`Spot ${modal.cell.label || ''} booked for ${date}.`);
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
      setModal(null);
    }
  };

  const cancel = async () => {
    setError('');
    setNotice('');
    try {
      await api.del(`/bookings/${modal.booking.id}`);
      setNotice('Booking cancelled.');
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
      setModal(null);
    }
  };

  const spots = data ? data.cells.filter((c) => c.type === 'spot') : [];
  const freeCount = spots.filter((c) => !bookingsByCell[c.id]).length;

  return (
    <div>
      <div className="toolbar">
        <h2>Parking availability</h2>
        <div className="toolbar-controls">
          <select value={floorId ?? ''} onChange={(e) => setFloorId(Number(e.target.value))}>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.spot_count} spots)
              </option>
            ))}
          </select>
          <input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} />
          <span className="zoom-ctl">
            <button className="btn btn-ghost" onClick={() => setCellSize((s) => Math.max(22, s - 6))}>−</button>
            <button className="btn btn-ghost" onClick={() => setCellSize((s) => Math.min(72, s + 6))}>+</button>
          </span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      {data && (
        <>
          <div className="stats-row">
            <span className="pill pill-green">{freeCount} available</span>
            <span className="pill pill-red">{spots.length - freeCount} booked</span>
            <span className="pill">{spots.length} total spots</span>
          </div>
          <div className="legend">
            <span><i className="sw available" /> Available</span>
            <span><i className="sw occupied" /> Booked</span>
            <span><i className="sw mine" /> Yours</span>
            <span><i className="sw blocked" /> Blocked</span>
            <span><i className="sw wall" /> Wall</span>
            <span><i className="sw elevator" /> Elevator</span>
            <span><i className="sw stairs" /> Stairs</span>
            <span><i className="sw entrance" /> Entrance</span>
          </div>
          <div className="grid-scroll">
            <FloorGrid
              floor={data.floor}
              cells={data.cells}
              bookingsByCell={bookingsByCell}
              onCellClick={onCellClick}
              cellSize={cellSize}
            />
          </div>
        </>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Spot {modal.cell.label || ''}</h3>
            {!modal.booking && (
              <>
                <p>
                  This spot is <strong>available</strong> on {date}.
                </p>
                {isPast ? (
                  <p className="muted">This date is in the past — booking is not possible.</p>
                ) : (
                  <button className="btn btn-primary" onClick={book}>
                    Book this spot
                  </button>
                )}
              </>
            )}
            {modal.booking && modal.booking.mine && (
              <>
                <p>This is <strong>your booking</strong> for {date}.</p>
                <button className="btn btn-danger" onClick={cancel}>
                  Cancel my booking
                </button>
              </>
            )}
            {modal.booking && !modal.booking.mine && (
              <>
                <p>
                  Booked by <strong>{modal.booking.userName}</strong> on {date}.
                </p>
                <p className="muted">Parked in front of you or blocking you in? Give them a call:</p>
                {modal.booking.userPhone ? (
                  <a className="btn btn-primary" href={`tel:${modal.booking.userPhone}`}>
                    📞 Call {modal.booking.userPhone}
                  </a>
                ) : (
                  <p className="muted">No phone number on file.</p>
                )}
              </>
            )}
            <button className="btn btn-ghost" onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
