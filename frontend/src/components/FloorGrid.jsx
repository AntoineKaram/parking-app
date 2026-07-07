// Shared grid renderer for the parking view and the admin floor designer.
// Background squares are rendered for every grid coordinate; items (walls, spots,
// elevators, ...) are layered on top. Spots/blocked spots span 2 squares via
// their orientation ('h' | 'v'); legacy 1-square spots (orientation null) still render.
const TYPE_META = {
  wall: { cls: 'wall', content: '', title: 'Wall' },
  blocked: { cls: 'blocked', content: '✕', title: 'Blocked — not available' },
  elevator: { cls: 'elevator', content: '🛗', title: 'Elevator' },
  stairs: { cls: 'stairs', content: '🪜', title: 'Stairs' },
  entrance: { cls: 'entrance', content: '🚘', title: 'Parking entrance' },
};

export default function FloorGrid({
  floor,
  cells,
  bookingsByCell = {},
  onCellClick,
  onCellDoubleClick,
  onCellEnter,
  onMouseDown,
  onMouseUp,
  cellSize = 44,
  touchPaint = false,
}) {
  const squares = [];
  for (let y = 0; y < floor.grid_height; y++) {
    for (let x = 0; x < floor.grid_width; x++) {
      squares.push(
        <div
          key={`sq-${x}-${y}`}
          className="cell empty"
          data-x={x}
          data-y={y}
          style={{ gridColumnStart: x + 1, gridRowStart: y + 1 }}
          onClick={() => onCellClick && onCellClick(x, y, null)}
          onMouseDown={(e) => {
            if (onMouseDown) {
              e.preventDefault();
              onMouseDown(x, y, null);
            }
          }}
          onMouseEnter={() => onCellEnter && onCellEnter(x, y, null)}
          onMouseUp={() => onMouseUp && onMouseUp()}
        />
      );
    }
  }

  const items = cells.map((c) => {
    const spanW = c.orientation === 'h' ? 2 : 1;
    const spanH = c.orientation === 'v' ? 2 : 1;
    let cls, content, title;
    if (c.type === 'spot') {
      const booking = c.id != null ? bookingsByCell[c.id] : null;
      if (booking && booking.mine) {
        cls = 'cell item spot mine';
        title = 'Your booking';
      } else if (booking) {
        cls = 'cell item spot occupied';
        title = `Booked by ${booking.userName}`;
      } else {
        cls = 'cell item spot available';
        title = 'Available';
      }
      content = c.label || 'P';
    } else {
      const meta = TYPE_META[c.type] || { cls: '', content: '?', title: c.type };
      cls = `cell item ${meta.cls}`;
      content = meta.content;
      title = meta.title;
    }
    return (
      <div
        key={`it-${c.x}-${c.y}`}
        className={cls}
        title={title}
        data-x={c.x}
        data-y={c.y}
        style={{
          gridColumn: `${c.x + 1} / span ${spanW}`,
          gridRow: `${c.y + 1} / span ${spanH}`,
        }}
        onClick={() => onCellClick && onCellClick(c.x, c.y, c)}
        onDoubleClick={() => onCellDoubleClick && onCellDoubleClick(c.x, c.y, c)}
        onMouseDown={(e) => {
          if (onMouseDown) {
            e.preventDefault();
            onMouseDown(c.x, c.y, c);
          }
        }}
        onMouseEnter={() => onCellEnter && onCellEnter(c.x, c.y, c)}
        onMouseUp={() => onMouseUp && onMouseUp()}
      >
        {content}
      </div>
    );
  });

  // touch painting (designer): resolve the square under the finger so drag works
  const touchToSquare = (e) => {
    const t = e.touches[0];
    if (!t) return null;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const sq = el && el.closest('[data-x]');
    if (!sq) return null;
    return [Number(sq.dataset.x), Number(sq.dataset.y)];
  };

  return (
    <div
      className="floor-grid"
      style={{
        gridTemplateColumns: `repeat(${floor.grid_width}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${floor.grid_height}, ${cellSize}px)`,
        touchAction: touchPaint ? 'none' : undefined,
      }}
      onMouseLeave={() => onMouseUp && onMouseUp()}
      onTouchStart={
        touchPaint
          ? (e) => {
              const s = touchToSquare(e);
              if (s && onMouseDown) onMouseDown(s[0], s[1], null);
            }
          : undefined
      }
      onTouchMove={
        touchPaint
          ? (e) => {
              const s = touchToSquare(e);
              if (s && onCellEnter) onCellEnter(s[0], s[1], null);
            }
          : undefined
      }
      onTouchEnd={touchPaint ? () => onMouseUp && onMouseUp() : undefined}
    >
      {squares}
      {items}
    </div>
  );
}
