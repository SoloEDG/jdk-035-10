import { sameCell, type Cell } from "@/shared/grid";

export const MAX_INTENT = 3;

/** 点选切换意图格：未标则追加（至多 max 格），已标则移除 */
export function toggleIntent(list: readonly Cell[], cell: Cell, max = MAX_INTENT): Cell[] {
  const index = list.findIndex((item) => sameCell(item, cell));
  if (index >= 0) return list.filter((_, i) => i !== index);
  if (list.length >= max) return [...list];
  return [...list, cell];
}

/** 从 from 到 to 的整段落点（含两端；移动为直线，等待时两端相同） */
function segmentCells(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  let cell = from;
  cells.push(cell);
  while (!sameCell(cell, to)) {
    cell = { x: cell.x + dx, y: cell.y + dy };
    cells.push(cell);
  }
  return cells;
}

/** 实际移动后，按顺序丢弃已被走到的意图格（只从队首消解，保持标定顺序） */
export function advanceIntent(list: readonly Cell[], from: Cell, to: Cell): Cell[] {
  const passed = segmentCells(from, to);
  const rest = [...list];
  while (rest.length && passed.some((cell) => sameCell(cell, rest[0]))) rest.shift();
  return rest;
}
