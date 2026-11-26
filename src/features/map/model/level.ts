import type { Cell } from "@/shared/grid";
import type { GateDef, Level, PedalDef, Terrain } from "@/shared/world";

// 东侧新增闸门走廊：第 10 行 ".1.2.3.E" 为三道周期闸门与撤离点，
// 第 9 行 a/b/c 为旁侧踏板，分别改指定闸门的开窗相位。
const blueprint = [
  "#########################",
  "#.....#..........########",
  "#.SS..#..MMM.....########",
  "#.SS.....MMM..T..########",
  "#.....##.....#...########",
  "###M####.....#...########",
  "#...M....###.....########",
  "#...M....#....SS.########",
  "#...MMM..#....SS.########",
  "#..#.........#...a#b#c###",
  "#P.####.~~~..#....1.2.3.E",
  "#########################"
];

const terrainByCode: Record<string, Terrain> = {
  "#": "wall", "S": "shelf", "M": "metal", "~": "mat"
};

// 闸门拍长与初始相位：窗长 window、相位 phase，回合 t 开窗当且仅当 (t - phase) mod period < window
const gateTuning: Record<string, { label: string; period: number; window: number; phase: number }> = {
  "1": { label: "壹", period: 3, window: 1, phase: 0 },
  "2": { label: "贰", period: 4, window: 2, phase: 1 },
  "3": { label: "叁", period: 5, window: 2, phase: 3 }
};

// 踏板改相量：踩下后指定闸门的相位自下一拍起后移 shift
const pedalTuning: Record<string, { gate: string; shift: number }> = {
  a: { gate: "1", shift: 1 },
  b: { gate: "2", shift: 1 },
  c: { gate: "3", shift: 2 }
};

function findMarker(code: string): Cell {
  for (const [y, row] of blueprint.entries()) {
    const x = row.indexOf(code);
    if (x >= 0) return { x, y };
  }
  throw new Error(`Missing map marker: ${code}`);
}

const columns = blueprint[0].length;
if (blueprint.some((row) => row.length !== columns)) throw new Error("Map rows must have equal widths");

const gates: GateDef[] = [];
const pedals: PedalDef[] = [];
blueprint.forEach((row, y) => {
  Array.from(row).forEach((code, x) => {
    const gate = gateTuning[code];
    if (gate) gates.push({ id: code, cell: { x, y }, ...gate });
    const pedal = pedalTuning[code];
    if (pedal) pedals.push({ id: code, cell: { x, y }, gateId: pedal.gate, shift: pedal.shift });
  });
});

export const archive: Level = {
  name: "静默档案馆",
  columns,
  rows: blueprint.length,
  tiles: blueprint.flatMap((row) => Array.from(row, (code) => terrainByCode[code] ?? "floor")),
  start: findMarker("P"),
  objective: findMarker("T"),
  exit: findMarker("E"),
  routes: [
    { id: "A", label: "回廊岗", facing: "east", points: [{ x: 7, y: 6 }, { x: 8, y: 6 }, { x: 8, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 6 }] },
    { id: "B", label: "档案岗", facing: "east", points: [{ x: 9, y: 2 }, { x: 13, y: 2 }, { x: 13, y: 3 }, { x: 9, y: 3 }] },
    { id: "C", label: "闸门岗", facing: "east", points: [{ x: 16, y: 9 }, { x: 17, y: 9 }, { x: 17, y: 10 }, { x: 16, y: 10 }] }
  ],
  gates,
  pedals
};
