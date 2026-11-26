<script setup lang="ts">
import { computed } from "vue";
import { ChevronUp, CircleDot, Cpu, DoorClosed, DoorOpen, Flag, Radio, ScanLine } from "lucide-vue-next";
import { cellKey, sameCell, type Cell, type Direction } from "@/shared/grid";
import type { GuardMode, Level } from "@/shared/world";

const props = defineProps<{
  level: Level;
  player: { cell: Cell; facing: Direction };
  guards: readonly { id: string; cell: Cell; facing: Direction; mode: GuardMode; target: Cell | null }[];
  visibility: Set<string>;
  secured: boolean;
  gates: readonly { id: string; label: string; cell: Cell; open: boolean }[];
  pedals: readonly { id: string; cell: Cell }[];
  intent: readonly Cell[];
  planCells: readonly Cell[];
}>();
const emit = defineEmits<{ mark: [Cell] }>();

const facingAngle: Record<Direction, number> = { north: 0, east: 90, south: 180, west: 270 };
const cells = computed(() => props.level.tiles.map((tile, i) => {
  const cell = { x: i % props.level.columns, y: Math.floor(i / props.level.columns) };
  const key = cellKey(cell);
  return {
    key, tile, xy: cell, guard: props.guards.find((guard) => sameCell(guard.cell, cell)),
    signal: props.guards.some((guard) => guard.target && sameCell(guard.target, cell)),
    visible: props.visibility.has(key),
    player: sameCell(props.player.cell, cell),
    objective: !props.secured && sameCell(props.level.objective, cell),
    exit: sameCell(props.level.exit, cell),
    gate: props.gates.find((gate) => sameCell(gate.cell, cell)) ?? null,
    pedal: props.pedals.find((pedal) => sameCell(pedal.cell, cell)) ?? null,
    intentIndex: props.intent.findIndex((mark) => sameCell(mark, cell)),
    planned: props.planCells.some((step) => sameCell(step, cell))
  };
}));
</script>

<template>
  <div class="map-frame" :style="{ '--columns': level.columns, '--rows': level.rows }">
    <div class="map-ruler map-ruler-x" aria-hidden="true">
      <span v-for="column in level.columns" :key="column">{{ String(column).padStart(2, '0') }}</span>
    </div>
    <div class="map-ruler map-ruler-y" aria-hidden="true">
      <span v-for="row in level.rows" :key="row">{{ String.fromCharCode(64 + row) }}</span>
    </div>
    <div class="map-grid" role="img" :aria-label="`行动地图，玩家位于 ${String.fromCharCode(65 + player.cell.y)}${player.cell.x + 1}`">
      <div v-for="cell in cells" :key="cell.key" class="tile" :class="[cell.tile, { 'in-sight': cell.visible }]"
        :data-cell="cell.key" :data-terrain="cell.tile" :data-visible="cell.visible || undefined"
        @click="emit('mark', cell.xy)">
        <i v-if="cell.tile === 'shelf'" class="shelf-lines" aria-hidden="true" />
        <ScanLine v-if="cell.exit" class="tile-icon exit-marker" :class="{ ready: secured }" />
        <Flag v-if="cell.exit" class="tile-icon exit-flag" :class="{ ready: secured }" />
        <Cpu v-if="cell.objective" class="tile-icon objective-marker" />
        <Radio v-if="cell.signal" class="tile-icon clue-marker" />
        <span v-if="cell.gate" class="gate-door" :class="{ open: cell.gate.open }" :data-gate="cell.gate.id"
          :title="`闸门${cell.gate.label} · ${cell.gate.open ? '下拍开窗' : '下拍关窗'}`">
          <DoorOpen v-if="cell.gate.open" /><DoorClosed v-else />
        </span>
        <span v-if="cell.pedal" class="pedal-disc" :data-pedal="cell.pedal.id" :title="`踏板 ${cell.pedal.id}`">
          <CircleDot /><b>{{ cell.pedal.id }}</b>
        </span>
        <i v-if="cell.planned && !cell.player" class="plan-dot" aria-hidden="true" />
        <span v-if="cell.intentIndex >= 0" class="intent-badge" :data-intent="cell.intentIndex + 1">{{ cell.intentIndex + 1 }}</span>
        <div v-if="cell.guard" class="unit guard" :class="cell.guard.mode" :data-guard="cell.guard.id"
          :style="{ '--facing': `${facingAngle[cell.guard.facing]}deg` }">
          <ChevronUp class="indicator" aria-hidden="true" /><span>{{ cell.guard.id }}</span>
        </div>
        <div v-if="cell.player" class="unit player" :style="{ '--facing': `${facingAngle[player.facing]}deg` }" data-player>
          <ChevronUp class="indicator" aria-hidden="true" /><span />
        </div>
      </div>
    </div>
  </div>
</template>
