<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eraser, Timer } from "lucide-vue-next";
import type { Command } from "@/shared/world";
import type { Rehearsal } from "../model/rehearsal";

const props = defineProps<{
  rehearsal: Rehearsal;
  hasIntent: boolean;
  intentCount: number;
  diverged: boolean;
  dash: boolean;
}>();
const emit = defineEmits<{ clear: [] }>();

const arrows = { north: ArrowUp, east: ArrowRight, south: ArrowDown, west: ArrowLeft } as const;
const headings = { north: "北", east: "东", south: "南", west: "西" } as const;

const steps = computed(() => props.rehearsal.steps.slice(0, 10));
const more = computed(() => props.rehearsal.steps.length - steps.value.length);

function iconOf(command: Command) {
  return command.type === "wait" ? Timer : arrows[command.direction];
}
function textOf(command: Command) {
  return command.type === "wait" ? "等待" : headings[command.direction];
}
function gateLabel(id: string) {
  return props.rehearsal.timelines.find((gate) => gate.id === id)?.label ?? id;
}
</script>

<template>
  <section class="status-section gate-section" aria-labelledby="gate-heading">
    <div class="section-heading">
      <h2 id="gate-heading">闸门走廊</h2>
      <button v-if="hasIntent" type="button" class="intent-clear" @click="emit('clear')">
        <Eraser :size="13" />清除意图
      </button>
    </div>
    <p class="gate-hint">{{ hasIntent ? `过廊意图 ${intentCount}/3 · 点选地图格子调整` : "点选地图格子，标出至多 3 格过廊意图" }}</p>
    <ul class="gate-list">
      <li v-for="gate in rehearsal.timelines" :key="gate.id">
        <div class="gate-row">
          <span class="gate-name">闸门{{ gate.label }}</span>
          <span class="gate-meta">拍长 {{ gate.period }} · 窗 {{ gate.window }}</span>
          <span class="gate-state" :class="{ open: gate.open[0] }" :data-gate-state="gate.id">
            {{ gate.open[0] ? "下拍开" : "下拍闭" }}
          </span>
        </div>
        <div class="gate-track">
          <div class="gate-strip" role="img" :aria-label="`闸门${gate.label}未来 ${gate.open.length} 回合开窗时序`">
            <i v-for="(open, i) in gate.open" :key="i" class="beat" :class="{ open, now: i === 0 }"
              :title="`回合 ${gate.startTurn + i + 1} · ${open ? '开窗' : '关窗'}`" />
          </div>
          <div class="gate-effects" aria-hidden="true">
            <span v-for="(effect, i) in gate.effects" :key="i" class="effect" :class="effect.by"
              :style="{ left: `${(effect.offset - 0.5) / gate.open.length * 100}%` }"
              :title="`回合 ${gate.startTurn + effect.offset} 起改相（${effect.by === 'guard' ? '守卫' : '玩家'}）`" />
          </div>
        </div>
      </li>
    </ul>
    <p v-if="diverged" class="diverged" role="status">已偏离预演 · 从实际落点重排余程</p>
    <template v-if="hasIntent">
      <ol v-if="rehearsal.feasible" class="plan-steps" aria-label="过廊预演时序">
        <li v-for="(step, i) in steps" :key="step.turn" :class="{ next: i === 0 }">
          <time>{{ String(step.turn).padStart(2, '0') }}</time>
          <component :is="iconOf(step.command)" :size="13" />
          <span>{{ textOf(step.command) }}</span>
          <em v-if="step.gate">入闸{{ gateLabel(step.gate) }}</em>
          <em v-if="step.pedal">踏板 {{ step.pedal }}</em>
        </li>
        <li v-if="more > 0" class="more">…共 {{ rehearsal.steps.length }} 手</li>
      </ol>
      <p v-else class="infeasible">{{ rehearsal.horizon }} 回合内走不通：试试踩踏板改相，或调整意图格</p>
    </template>
    <p class="gate-note">预演按单步移动、守卫未受惊扰排程<span v-if="dash">；疾跑一回合跨两格，请先切回潜行或行走</span></p>
  </section>
</template>
