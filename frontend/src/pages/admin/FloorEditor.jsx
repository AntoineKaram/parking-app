import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import FloorGrid from '../../components/FloorGrid';

const TOOLS = [
  { key: 'spot', label: '🅿 Spot', hint: 'Bookable parking spot (2 squares)' },
  { key: 'blocked', label: '✕ Blocked', hint: 'Blocked parking spot (2 squares)' },
  { key: 'wall', label: '⬛ Wall', hint: 'Wall / structure' },
  { key: 'elevator', label: '🛗 Elevator', hint: 'Elevator' },
  { key: 'stairs', label: '🪜 Stairs', hint: 'Stairs' },
  { key: 'entrance', label: '🚘 Entrance', hint: 'Parking entrance' },
  { key: 'erase', label: '⌫ Erase', hint: 'Clear cell (driving lane)' },
];

// spots and blocked spots occupy 2 grid squares
const SPAN_TOOLS = ['spot', 'blocked'];

function footprint(c) {
  const squares = [[c.x, c.y]];
  if (c.orientation === 'h') squares.push([c.x + 1, c.y]);
  if (c.orientation === 'v') squares.push([c.x, c.y + 1]);
  return squares;
}

export default function FloorEditor() {
  const [floors, setFloors] = useState([]);
  const [floor, setFloor] = useState(null);
  const [cells, setCells] = useState({}); // anchor key "x,y" -> {x,y,type,label,orientation}
  const [tool, setTool] = useState('spot');
  const [orientation, setOrientation] = useState('v');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cellSize, setCellSize] = useState(() => (window.innerWidth < 640 ? 32 : 40));
  const [newFloor, setNewFloor] = useState({ name: '', grid_width: 14, grid_height: 10 });
  const painting = useRef(false);

  const loadFloors = () =>
    api
      .get('/floors')
      .then((d) => setFloors(d.floors))
      .catch((e) => setError(e.message));

  useEffect(() => {
    loadFloors();
  }, []);

  const selectFloor = async (f) => {
    if (dirty && !window.confirm('Discard unsaved layout changes?')) return;
    setError('');
    setNotice('');
    try {
      const d = await api.get(`/floors/${f.id}`);
      setFloor(d.floor);
      const map = {};
      for (const c of d.cells) map[`${c.x},${c.y}`] = c;
      setCells(map);
      setDirty(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const paint = (x, y) => {
    if (!floor) return;
    setCells((prev) => {
      // occupancy: every covered square -> anchor key
      const occ = {};
      for (const key of Object.keys(prev)) {
        for (const [sx, sy] of footprint(prev[key])) occ[`${sx},${sy}`] = key;
      }
      const next = { ...prev };
      const removeCovering = (squares) => {
        for (const [sx, sy] of squares) {
          const k = occ[`${sx},${sy}`];
          if (k) delete next[k];
        }
      };

      if (tool === 'erase') {
        const k = occ[`${x},${y}`];
        if (!k) return prev;
        delete next[k];
      } else if (SPAN_TOOLS.includes(tool)) {
        const cell = { x, y, type: tool, orientation, label: null };
        const fp = footprint(cell);
        if (fp.some(([sx, sy]) => sx >= floor.grid_width || sy >= floor.grid_height)) return prev;
        // dragging across a piece we just placed shouldn't move it
        if (
          fp.some(([sx, sy]) => {
            const k = occ[`${sx},${sy}`];
            return k && next[k] && next[k].type === tool;
          })
        ) {
          return prev;
        }
        removeCovering(fp);
        const replaced = prev[`${x},${y}`];
        if (replaced && replaced.type === tool) cell.label = replaced.label;
        next[`${x},${y}`] = cell;
      } else {
        const k = occ[`${x},${y}`];
        if (k && next[k] && next[k].type === tool && k === `${x},${y}`) return prev;
        removeCovering([[x, y]]);
        next[`${x},${y}`] = { x, y, type: tool, orientation: null, label: null };
      }
      return next;
    });
    setDirty(true);
  };

  const onMouseDown = (x, y) => {
    painting.current = true;
    paint(x, y);
  };
  const onCellEnter = (x, y) => {
    if (painting.current) paint(x, y);
  };
  const onMouseUp = () => {
    painting.current = false;
  };

  const renameSpot = (x, y, cell) => {
    if (!cell || cell.type !== 'spot') return;
    const label = window.prompt('Spot label:', cell.label || '');
    if (label === null) return;
    setCells((prev) => ({ ...prev, [`${x},${y}`]: { ...cell, label: label.trim() || null } }));
    setDirty(true);
  };

  const save = async () => {
    if (!floor) return;
    setError('');
    setNotice('');
    // auto-label unnamed spots: P1, P2, ... skipping labels already in use
    const list = Object.values(cells);
    const used = new Set(list.filter((c) => c.label).map((c) => c.label));
    let n = 1;
    const payload = list.map((c) => {
      if (c.type === 'spot' && !c.label) {
        while (used.has(`P${n}`)) n++;
        const label = `P${n}`;
        used.add(label);
        return { ...c, label };
      }
      return c;
    });
    try {
      const d = await api.put(`/floors/${floor.id}/cells`, {
        cells: payload.map(({ x, y, type, label, orientation: o }) => ({ x, y, type, label, orientation: o })),
      });
      const map = {};
      for (const c of d.cells) map[`${c.x},${c.y}`] = c;
      setCells(map);
      setDirty(false);
      setNotice('Layout saved. Bookings on removed/blocked spots were cancelled.');
      loadFloors();
    } catch (e) {
      setError(e.message);
    }
  };

  const createFloor = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const d = await api.post('/floors', newFloor);
      setNewFloor({ name: '', grid_width: 14, grid_height: 10 });
      await loadFloors();
      selectFloor(d.floor);
    } catch (err) {
      setError(err.message);
    }
  };

  const resizeFloor = async () => {
    const w = Number(window.prompt('Grid width (2-60):', floor.grid_width));
    const h = Number(window.prompt('Grid height (2-60):', floor.grid_height));
    if (!w || !h) return;
    try {
      await api.put(`/floors/${floor.id}`, { name: floor.name, grid_width: w, grid_height: h });
      await loadFloors();
      selectFloor({ id: floor.id });
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteFloor = async () => {
    if (!window.confirm(`Delete floor "${floor.name}" and all its bookings?`)) return;
    try {
      await api.del(`/floors/${floor.id}`);
      setFloor(null);
      setCells({});
      setDirty(false);
      loadFloors();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="editor-layout">
      <aside className="editor-side">
        <h2>Floors</h2>
        <ul className="floor-list">
          {floors.map((f) => (
            <li key={f.id}>
              <button
                className={floor?.id === f.id ? 'floor-item active' : 'floor-item'}
                onClick={() => selectFloor(f)}
              >
                {f.name} <span className="muted">({f.spot_count} spots)</span>
              </button>
            </li>
          ))}
        </ul>
        <h3>New floor</h3>
        <form onSubmit={createFloor} className="stack">
          <input
            placeholder="Floor name (e.g. Level -2)"
            value={newFloor.name}
            onChange={(e) => setNewFloor({ ...newFloor, name: e.target.value })}
            required
          />
          <div className="row">
            <label className="inline">
              W
              <input
                type="number" min="2" max="60"
                value={newFloor.grid_width}
                onChange={(e) => setNewFloor({ ...newFloor, grid_width: Number(e.target.value) })}
              />
            </label>
            <label className="inline">
              H
              <input
                type="number" min="2" max="60"
                value={newFloor.grid_height}
                onChange={(e) => setNewFloor({ ...newFloor, grid_height: Number(e.target.value) })}
              />
            </label>
          </div>
          <button className="btn btn-primary">Create floor</button>
        </form>
      </aside>

      <section className="editor-main">
        {error && <div className="error">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        {!floor ? (
          <p className="muted">Select a floor on the left, or create a new one.</p>
        ) : (
          <>
            <div className="toolbar">
              <h2>{floor.name}</h2>
              <div className="toolbar-controls">
                <span className="zoom-ctl">
                  <button className="btn btn-ghost" onClick={() => setCellSize((s) => Math.max(22, s - 6))}>−</button>
                  <button className="btn btn-ghost" onClick={() => setCellSize((s) => Math.min(72, s + 6))}>+</button>
                </span>
                <button className="btn btn-ghost" onClick={resizeFloor}>Resize</button>
                <button className="btn btn-danger" onClick={deleteFloor}>Delete floor</button>
                <button className="btn btn-primary" onClick={save} disabled={!dirty}>
                  {dirty ? 'Save layout *' : 'Saved'}
                </button>
              </div>
            </div>
            <div className="tool-row">
              {TOOLS.map((t) => (
                <button
                  key={t.key}
                  title={t.hint}
                  className={tool === t.key ? 'btn tool active' : 'btn tool'}
                  onClick={() => setTool(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {SPAN_TOOLS.includes(tool) && (
              <div className="tool-row">
                <span className="muted">Spot direction:</span>
                <button
                  className={orientation === 'v' ? 'btn tool active' : 'btn tool'}
                  onClick={() => setOrientation('v')}
                >
                  ↕ Vertical
                </button>
                <button
                  className={orientation === 'h' ? 'btn tool active' : 'btn tool'}
                  onClick={() => setOrientation('h')}
                >
                  ↔ Horizontal
                </button>
              </div>
            )}
            <div className="grid-scroll">
              <FloorGrid
                floor={floor}
                cells={Object.values(cells)}
                onMouseDown={onMouseDown}
                onCellEnter={onCellEnter}
                onMouseUp={onMouseUp}
                onCellDoubleClick={renameSpot}
                cellSize={cellSize}
                touchPaint
              />
            </div>
            <p className="muted">
              Tap or click/drag to paint. Spots and blocked spots take <strong>2 squares</strong> —
              pick their direction above. Double-click a spot to rename it; unnamed spots get labels
              automatically on save.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
