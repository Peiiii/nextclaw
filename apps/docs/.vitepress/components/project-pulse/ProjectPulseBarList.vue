<script setup lang="ts">
import { computed } from 'vue'

type BarItem = {
  name: string
  value: number
  meta?: string
}

const props = defineProps<{
  items: BarItem[]
}>()

const maxValue = computed(() =>
  props.items.reduce((result, item) => Math.max(result, item.value), 0)
)

const withWidth = computed(() =>
  props.items.map((item) => ({
    ...item,
    widthPercent: maxValue.value > 0 ? Number(((item.value / maxValue.value) * 100).toFixed(1)) : 0
  }))
)
</script>

<template>
  <div class="bar-list">
    <div v-for="item in withWidth" :key="item.name" class="bar-list__row">
      <div class="bar-list__head">
        <span class="bar-list__name">{{ item.name }}</span>
        <span class="bar-list__value">{{ item.value.toLocaleString() }}</span>
      </div>
      <div class="bar-list__track">
        <div class="bar-list__fill" :style="{ width: `${item.widthPercent}%` }" />
      </div>
      <div v-if="item.meta" class="bar-list__meta">{{ item.meta }}</div>
    </div>
  </div>
</template>

<style scoped>
.bar-list {
  display: grid;
  gap: 0.95rem;
}

.bar-list__row {
  display: grid;
  gap: 0.45rem;
}

.bar-list__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
}

.bar-list__name {
  font-size: 0.92rem;
  color: #132639;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-list__value {
  font-size: 0.86rem;
  color: rgba(19, 38, 57, 0.72);
}

.bar-list__track {
  width: 100%;
  height: 0.6rem;
  border-radius: 999px;
  background: rgba(19, 38, 57, 0.08);
  overflow: hidden;
}

.bar-list__fill {
  height: 100%;
  border-radius: inherit;
  background:
    linear-gradient(90deg, rgba(11, 170, 144, 0.95) 0%, rgba(22, 149, 255, 0.95) 100%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18) inset;
}

.bar-list__meta {
  font-size: 0.78rem;
  color: rgba(19, 38, 57, 0.56);
}
</style>
