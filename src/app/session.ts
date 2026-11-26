import { sameCell } from "@/shared/grid";
import type { Command, GuardPerception, RunEvent } from "@/shared/world";
import { archive } from "@/features/map";
import { createActor, resolveCommand, stances, type Actor } from "@/features/player";
import { advanceGuards, createGuards, respondToClues, type Guard } from "@/features/patrol";
import { measure } from "@/features/alert";
import { describeTurn, initialEvent, markObjective, type Objective } from "@/features/mission";
import {
  applyEvents, closedGateCells, createTimings, pedalAt, pressEvent, type GateTiming
} from "@/features/gates";

export interface Session {
  readonly turn: number;
  readonly actor: Actor;
  readonly guards: readonly Guard[];
  readonly gates: readonly GateTiming[];
  readonly readings: readonly GuardPerception[];
  readonly objective: Objective;
  readonly log: readonly RunEvent[];
}

export function startSession(): Session {
  return {
    turn: 0,
    actor: createActor(archive.start),
    guards: createGuards(archive),
    gates: createTimings(archive),
    readings: [],
    objective: { phase: "retrieve", securedAt: null },
    log: [initialEvent]
  };
}

export function applyCommand(session: Session, command: Command): Session {
  if (session.objective.phase === "escaped" || session.objective.phase === "caught") return session;
  const turn = session.turn + 1;
  // 关窗的闸门格本回合不可进入（已在门上者离开不受限，原开窗供其走完）
  const movement = resolveCommand(archive, session.actor, command, session.guards.map((guard) => guard.cell),
    closedGateCells(session.gates, turn));
  if (!movement) return session;

  const contactBefore = session.guards.some((guard) => sameCell(guard.cell, movement.actor.cell));
  const moved = contactBefore ? session.guards : advanceGuards(archive, session.guards);

  // 踏板：玩家跨过的格子与守卫新踏入的格子都会踩下踏板，改相自下一拍起生效
  const presses: (ReturnType<typeof pressEvent>)[] = [];
  const notes: RunEvent[] = [];
  const gateLabel = (gateId: string) => archive.gates.find((gate) => gate.id === gateId)?.label ?? gateId;
  const stepped = new Set<string>();
  for (const cell of movement.crossed) {
    const pedal = pedalAt(archive, cell);
    if (!pedal || stepped.has(pedal.id)) continue;
    stepped.add(pedal.id);
    presses.push(pressEvent(archive, pedal, turn, "player"));
    notes.push({ turn, tone: "neutral", text: `已踩下踏板 ${pedal.id}：闸门${gateLabel(pedal.gateId)}相位自下一拍起后移` });
  }
  moved.forEach((guard, index) => {
    if (sameCell(guard.cell, session.guards[index].cell)) return;
    const pedal = pedalAt(archive, guard.cell);
    if (!pedal) return;
    presses.push(pressEvent(archive, pedal, turn, "guard"));
    notes.push({ turn, tone: "alert", text: `守卫 ${guard.route.id} 踩动踏板 ${pedal.id}：闸门${gateLabel(pedal.gateId)}相位将变` });
  });
  const gates = applyEvents(session.gates, presses, turn);

  const sensors = moved.map((guard) => ({ id: guard.route.id, cell: guard.cell, facing: guard.facing }));
  const trace = movement.crossed.length ? movement.crossed : [movement.actor.cell];
  const readings = measure(archive, sensors, trace, movement.footsteps, session.readings, stances[movement.actor.stance].sightGain);
  const guards = respondToClues(moved, readings);
  const caught = contactBefore || moved.some((guard) => sameCell(guard.cell, movement.actor.cell))
    || readings.some((reading) => reading.points >= 100);
  const objective = markObjective(archive, session.objective, trace, caught, turn);
  const identified = guards.filter((guard, index) => guard.mode === "investigate" && moved[index].mode !== guard.mode)
    .map((guard) => guard.route.id);
  const log = describeTurn({ turn, before: session.objective, after: objective, observations: readings, identified });
  return { turn, actor: movement.actor, guards, gates, readings, objective, log: [...session.log, ...log, ...notes].slice(-24) };
}
