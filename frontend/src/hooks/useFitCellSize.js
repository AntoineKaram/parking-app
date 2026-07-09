import { useCallback, useEffect, useState } from 'react';

// Auto-fit the grid cell size so the whole floor width fits the container
// (re-fits on floor change and window resize; zoom buttons can still override).
export default function useFitCellSize(floor, containerRef, { min = 14, max = 44 } = {}) {
  const [cellSize, setCellSize] = useState(36);

  const fit = useCallback(() => {
    if (!floor || !containerRef.current) return;
    // grid has 10px padding + 1px border per side, and 2px gaps between cells
    const available = containerRef.current.clientWidth - 22 - 2 * (floor.grid_width - 1);
    const size = Math.floor(available / floor.grid_width);
    setCellSize(Math.max(min, Math.min(max, size)));
  }, [floor, containerRef, min, max]);

  useEffect(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  return [cellSize, setCellSize];
}
