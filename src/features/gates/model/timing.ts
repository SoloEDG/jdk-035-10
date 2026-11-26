import { cellKey, type Cell } from "@/shared/grid";
import type { GateDef, Level, PedalDef } from "@/shared/world";

/** 一次改相：从 fromTurn（某拍起点）起，相位后移 shift */
export interface GateEvent {
  readonly fromTurn: number;
  readonly shift: number;
  readonly by: "player" | "guard";
}

export interface GateTiming {
  readonly def: GateDef;
  /** 已生效事件折叠后的基准相位 */
  readonly basePhase: number;
  /** 已排定但尚未生效的改相事件 */
  readonly events: readonly GateEvent[];
}

export function createTimings(level: Level): GateTiming[] {
  return level.gates.map((def) => ({ def, basePhase: def.phase, events: [] }));
}

/** 下一拍起点：回合 turn 内踩下的踏板，自该拍之后的下一拍起生效 */
export function nextBeatStart(turn: number, period: number) {
  return (Math.floor(turn / period) + 1) * period;
}

/** 回合 turn 的实际相位：基准相位叠加所有已生效事件（extra 为预演中的假想事件） */
export function phaseAt(timing: GateTiming, turn: number, extra: readonly GateEvent[] = []): number {
  let phase = timing.basePhase;
  for (const event of timing.events) if (event.fromTurn <= turn) phase += event.shift;
  for (const event of extra) if (event.fromTurn <= turn) phase += event.shift;
  const period = timing.def.period;
  return ((phase % period) + period) % period;
}

/** 回合 turn 该闸门是否开窗 */
export function isOpenAt(timing: GateTiming, turn: number, extra: readonly GateEvent[] = []): boolean {
  const { period, window } = timing.def;
  const offset = (((turn - phaseAt(timing, turn, extra)) % period) + period) % period;
  return offset < window;
}

/** 回合 turn 处于关窗的闸门格集合（用于阻挡进入；离开闸门格不受限，供跨门者走完） */
export function closedGateCells(timings: readonly GateTiming[], turn: number): Set<string> {
  const closed = new Set<string>();
  for (const timing of timings) if (!isOpenAt(timing, turn)) closed.add(cellKey(timing.def.cell));
  return closed;
}

export function gateAt(level: Level, cell: Cell): GateDef | undefined {
  return level.gates.find((gate) => gate.cell.x === cell.x && gate.cell.y === cell.y);
}

export function pedalAt(level: Level, cell: Cell): PedalDef | undefined {
  return level.pedals.find((pedal) => pedal.cell.x === cell.x && pedal.cell.y === cell.y);
}

/** 把一次踩踏转成改相事件（自下一拍起生效） */
export function pressEvent(level: Level, pedal: PedalDef, turn: number, by: GateEvent["by"]): GateEvent & { gateId: string } {
  const def = level.gates.find((gate) => gate.id === pedal.gateId);
  if (!def) throw new Error(`Pedal ${pedal.id} targets unknown gate ${pedal.gateId}`);
  return { gateId: pedal.gateId, fromTurn: nextBeatStart(turn, def.period), shift: pedal.shift, by };
}

/** 追加新事件，并把已生效的事件折叠进基准相位 */
export function applyEvents(timings: readonly GateTiming[], events: readonly (GateEvent & { gateId: string })[], turn: number): GateTiming[] {
  return timings.map((timing) => {
    const added = events.filter((event) => event.gateId === timing.def.id);
    const pending = [...timing.events, ...added];
    if (!added.length && pending.every((event) => event.fromTurn > turn)) return timing;
    let base = timing.basePhase;
    const future: GateEvent[] = [];
    for (const event of pending) {
      if (event.fromTurn <= turn) base += event.shift;
      else future.push(event);
    }
    const period = timing.def.period;
    return { def: timing.def, basePhase: ((base % period) + period) % period, events: future };
  });
}
