import { addCell, cellKey, directions, sameCell, type Cell } from "@/shared/grid";
import type { Command, Level } from "@/shared/world";
import { isWalkable } from "@/features/map";
import { advanceGuards, type Guard } from "@/features/patrol";
import { gateAt, isOpenAt, pedalAt, pressEvent, type GateEvent, type GateTiming } from "./timing";

export interface PlanStep {
  readonly turn: number;
  readonly command: Command;
  readonly cell: Cell;
  /** 本手进入的闸门 */
  readonly gate: string | null;
  /** 本手踩下的踏板 */
  readonly pedal: string | null;
}

export interface GateEffect {
  /** 相对当前回合的偏移（1 起），该拍起相位生效 */
  readonly offset: number;
  readonly by: GateEvent["by"];
}

export interface GateTimeline {
  readonly id: string;
  readonly label: string;
  readonly period: number;
  readonly window: number;
  readonly startTurn: number;
  /** open[i] 对应回合 startTurn + i + 1 */
  readonly open: readonly boolean[];
  readonly effects: readonly GateEffect[];
}

export interface Rehearsal {
  readonly feasible: boolean;
  readonly steps: readonly PlanStep[];
  readonly timelines: readonly GateTimeline[];
  readonly horizon: number;
}

export interface RehearsalState {
  readonly turn: number;
  readonly actorCell: Cell;
  readonly guards: readonly Guard[];
  readonly gates: readonly GateTiming[];
}

const HORIZON = 60;
const DISPLAY = 24;
const MAX_EXPANSIONS = 60000;

type PlayerEvent = GateEvent & { gateId: string };

interface Node {
  readonly cell: Cell;
  readonly turn: number;
  readonly wp: number;
  readonly events: readonly PlayerEvent[];
  readonly parent: Node | null;
  readonly command: Command | null;
}

const actions: readonly Command[] = [
  { type: "wait" },
  { type: "move", direction: "north" },
  { type: "move", direction: "east" },
  { type: "move", direction: "south" },
  { type: "move", direction: "west" }
];

/**
 * 过廊预演：从实际落点与当前门窗排期出发，逐回合模拟守卫巡逻（含守卫踩踏板
 * 造成的改拍），在 (格, 回合) 展开图上搜索一条依次走过全部意图格、且只借
 * 当时仍开着窗口的走法；允许插入等待，因此不会贪最早抵达而错过后一道门。
 */
export function rehearse(level: Level, state: RehearsalState, waypoints: readonly Cell[],
  horizon = HORIZON, display = DISPLAY): Rehearsal {
  const t0 = state.turn;

  // —— 守卫世界线：假设守卫未受新的惊扰，按现行模式逐回合推进 ——
  const guardCells: Set<string>[] = [new Set(state.guards.map((guard) => cellKey(guard.cell)))];
  const guardEvents: PlayerEvent[] = [];
  let simulated = state.guards;
  for (let turn = t0 + 1; turn <= t0 + horizon; turn++) {
    const before = simulated;
    simulated = advanceGuards(level, simulated);
    simulated.forEach((guard, index) => {
      if (sameCell(guard.cell, before[index].cell)) return;
      const pedal = pedalAt(level, guard.cell);
      if (pedal) guardEvents.push(pressEvent(level, pedal, turn, "guard"));
    });
    guardCells.push(new Set(simulated.map((guard) => cellKey(guard.cell))));
  }

  const timingOf = (gateId: string) => {
    const timing = state.gates.find((item) => item.def.id === gateId);
    if (!timing) throw new Error(`Unknown gate ${gateId}`);
    return timing;
  };
  const openAt = (gateId: string, turn: number, playerEvents: readonly PlayerEvent[]) =>
    isOpenAt(timingOf(gateId), turn, [
      ...guardEvents.filter((event) => event.gateId === gateId),
      ...playerEvents.filter((event) => event.gateId === gateId)
    ]);

  // —— 逐手搜索：移动/等待，进闸必须当拍开窗，离闸不限（原开窗供跨门者走完） ——
  let steps: PlanStep[] = [];
  let feasible = false;
  let goalEvents: readonly PlayerEvent[] = [];
  if (waypoints.length) {
    let wp0 = 0;
    while (wp0 < waypoints.length && sameCell(state.actorCell, waypoints[wp0])) wp0++;
    const start: Node = { cell: state.actorCell, turn: t0, wp: wp0, events: [], parent: null, command: null };
    const keyOf = (cell: Cell, turn: number, wp: number, events: readonly PlayerEvent[]) =>
      `${cell.x},${cell.y}|${turn}|${wp}|${events.map((event) => `${event.gateId}@${event.fromTurn}:${event.shift}`).join(";")}`;
    const visited = new Set([keyOf(start.cell, start.turn, start.wp, start.events)]);
    const queue: Node[] = [start];
    const isGoal = (node: Node) => node.wp === waypoints.length && !gateAt(level, node.cell);
    let goal: Node | null = null;
    let expansions = 0;
    for (let head = 0; head < queue.length && !goal && expansions < MAX_EXPANSIONS; head++) {
      const node = queue[head];
      if (isGoal(node)) { goal = node; break; }
      if (node.turn - t0 >= horizon) continue;
      expansions++;
      for (const command of actions) {
        const turn = node.turn + 1;
        const dest = command.type === "wait" ? node.cell : addCell(node.cell, directions[command.direction]);
        if (command.type === "move") {
          if (!isWalkable(level, dest)) continue;
          const gate = gateAt(level, dest);
          if (gate && !openAt(gate.id, turn, node.events)) continue;
        }
        // 与实际回合同序：先玩家后守卫，落点不得撞上守卫移动前后的位置
        if (guardCells[node.turn - t0].has(cellKey(dest))) continue;
        if (guardCells[turn - t0]?.has(cellKey(dest))) continue;
        let events = node.events;
        if (command.type === "move") {
          const pedal = pedalAt(level, dest);
          if (pedal) events = [...events, pressEvent(level, pedal, turn, "player")];
        }
        let wp = node.wp;
        if (wp < waypoints.length && sameCell(dest, waypoints[wp])) wp++;
        const key = keyOf(dest, turn, wp, events);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ cell: dest, turn, wp, events, parent: node, command });
      }
    }
    if (goal) {
      feasible = true;
      goalEvents = goal.events;
      const chain: Node[] = [];
      for (let node: Node | null = goal; node?.parent; node = node.parent) chain.unshift(node);
      steps = chain.map((node) => ({
        turn: node.turn,
        command: node.command as Command,
        cell: node.cell,
        gate: node.command?.type === "move" ? gateAt(level, node.cell)?.id ?? null : null,
        pedal: node.command?.type === "move" ? pedalAt(level, node.cell)?.id ?? null : null
      }));
    }
  }

  // —— 门窗时序条：计入守卫改拍与预演中玩家将踩的踏板 ——
  const timelines: GateTimeline[] = level.gates.map((def) => {
    const timing = timingOf(def.id);
    const open: boolean[] = [];
    for (let i = 1; i <= display; i++) open.push(openAt(def.id, t0 + i, goalEvents));
    const inRange = (event: GateEvent) => event.fromTurn > t0 && event.fromTurn <= t0 + display;
    const effects: GateEffect[] = [
      ...timing.events.filter(inRange).map((event) => ({ offset: event.fromTurn - t0, by: event.by })),
      ...guardEvents.filter((event) => event.gateId === def.id && inRange(event))
        .map((event) => ({ offset: event.fromTurn - t0, by: event.by })),
      ...goalEvents.filter((event) => event.gateId === def.id && inRange(event))
        .map((event) => ({ offset: event.fromTurn - t0, by: event.by }))
    ];
    return { id: def.id, label: def.label, period: def.period, window: def.window, startTurn: t0, open, effects };
  });

  return { feasible, steps, timelines, horizon };
}
