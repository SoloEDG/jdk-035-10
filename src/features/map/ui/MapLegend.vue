<script setup lang="ts">
import { CircleDot, Cpu, DoorClosed, DoorOpen, Flag, Radio } from "lucide-vue-next";
import { terrainRules } from "../model/terrain";
</script>

<template>
  <ul class="map-legend" aria-label="地图图例">
    <li><i class="legend-token player-token" />玩家</li>
    <li><i class="legend-token guard-token" />守卫</li>
    <li><i class="legend-token sight-token" />视野</li>
    <li><i class="legend-token metal" />{{ terrainRules.metal.label }}</li>
    <li><i class="legend-token mat" />{{ terrainRules.mat.label }}</li>
    <li><DoorOpen />闸门开</li>
    <li><DoorClosed />闸门闭</li>
    <li><CircleDot />踏板</li>
    <li><i class="legend-token intent-token" />意图</li>
    <li><i class="legend-token plan-token" />预演</li>
    <li><Cpu />档案核心</li>
    <li><Flag />撤离点</li>
    <li><Radio />调查点</li>
  </ul>
</template>
