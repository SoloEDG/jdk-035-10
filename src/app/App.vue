<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import { Aperture, RotateCcw } from "lucide-vue-next";
import { archive, isWalkable, MapLegend, SceneMap } from "@/features/map";
import { keyboardIntent, PlayerControls } from "@/features/player";
import { PatrolPanel } from "@/features/patrol";
import { AlertPanel, visibleCells } from "@/features/alert";
import { EventLog, MissionPanel, phaseLabels } from "@/features/mission";
import { advanceIntent, GatePanel, isOpenAt, rehearse, toggleIntent } from "@/features/gates";
import { sameCell, type Cell } from "@/shared/grid";
import type { Command, Stance } from "@/shared/world";
import { applyCommand, startSession } from "./session";

const session = shallowRef(startSession());
const intent = ref<Cell[]>([]);
const diverged = ref(false);
const finished = computed(() => session.value.objective.phase === "escaped" || session.value.objective.phase === "caught");
const mapGuards = computed(() => session.value.guards.map((guard) => ({
  id: guard.route.id, cell: guard.cell, facing: guard.facing, mode: guard.mode, target: guard.target
})));
const visibility = computed(() => visibleCells(archive, mapGuards.value));
const mapGates = computed(() => archive.gates.map((def) => {
  const timing = session.value.gates.find((gate) => gate.def.id === def.id);
  return { id: def.id, label: def.label, cell: def.cell, open: timing ? isOpenAt(timing, session.value.turn + 1) : false };
}));

// 预演始终从实际落点与当前门窗排期重算：差异发生后余程自动重排
const rehearsal = computed(() => rehearse(archive, {
  turn: session.value.turn,
  actorCell: session.value.actor.cell,
  guards: session.value.guards,
  gates: session.value.gates
}, intent.value));
const planHead = computed(() => intent.value.length && rehearsal.value.feasible ? rehearsal.value.steps[0] ?? null : null);
const hint = computed(() => planHead.value?.command ?? null);
const planCells = computed(() => rehearsal.value.steps.map((step) => step.cell));

function send(command: Command) {
  const head = planHead.value;
  const before = session.value;
  const next = applyCommand(before, command);
  if (next === before) return;
  intent.value = advanceIntent(intent.value, before.actor.cell, next.actor.cell);
  diverged.value = !!head && (
    head.command.type !== command.type
    || (head.command.type === "move" && command.type === "move" && head.command.direction !== command.direction)
    || !sameCell(head.cell, next.actor.cell)
  );
  session.value = next;
}

function setStance(stance: Stance) {
  if (finished.value) return;
  session.value = { ...session.value, actor: { ...session.value.actor, stance } };
}

function mark(cell: Cell) {
  if (finished.value || !isWalkable(archive, cell)) return;
  intent.value = toggleIntent(intent.value, cell);
}

function reset() {
  session.value = startSession();
  intent.value = [];
  diverged.value = false;
}

function onKeydown(event: KeyboardEvent) {
  const intentKey = keyboardIntent(event);
  if (!intentKey?.command && !intentKey?.stance) return;
  event.preventDefault();
  if (intentKey.command) send(intentKey.command);
  if (intentKey.stance) setStance(intentKey.stance);
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="wordmark"><Aperture :size="23" /><span>NIGHT CIRCUIT</span><small>午夜回路</small></div>
      <button class="reset" type="button" @click="reset"><RotateCcw :size="15" />重开</button>
    </div>
  </header>
  <main class="workspace">
    <div class="heading">
      <h1>{{ archive.name }}</h1>
      <span class="turn" data-turn>回合 <b>{{ String(session.turn).padStart(2, '0') }}</b></span>
    </div>
    <div class="workspace-columns">
      <section class="board" aria-label="行动区">
        <SceneMap :level="archive" :player="session.actor" :guards="mapGuards" :visibility="visibility"
          :secured="session.objective.securedAt !== null" :gates="mapGates" :pedals="archive.pedals"
          :intent="intent" :plan-cells="planCells" @mark="mark" />
        <MapLegend />
        <PlayerControls :actor="session.actor" :finished="finished" :hint="hint" @command="send" @stance="setStance" />
        <p v-if="finished" class="outcome" :class="session.objective.phase" role="status">{{ phaseLabels[session.objective.phase] }}</p>
      </section>
      <aside class="telemetry" aria-label="任务情报">
        <MissionPanel :objective="session.objective" />
        <GatePanel :rehearsal="rehearsal" :has-intent="intent.length > 0" :intent-count="intent.length"
          :diverged="diverged" :dash="session.actor.stance === 'dash'" @clear="intent = []" />
        <AlertPanel :readings="session.readings" />
        <PatrolPanel :guards="session.guards" />
        <EventLog :events="session.log" />
      </aside>
    </div>
  </main>
</template>
