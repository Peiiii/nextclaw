<script setup lang="ts">
import { computed } from 'vue'

type DataPoint = {
  key: string
  label: string
  value: number
}

const props = defineProps<{
  chartId: string
  series: DataPoint[]
  accentStart: string
  accentEnd: string
}>()

const width = 100
const height = 44
const bottom = 38
const top = 6

const maxValue = computed(() =>
  props.series.reduce((result, item) => Math.max(result, item.value), 0)
)
const minValue = computed(() =>
  props.series.reduce((result, item) => Math.min(result, item.value), props.series[0]?.value ?? 0)
)

const points = computed(() => {
  if (props.series.length === 0) {
    return []
  }

  const step = props.series.length > 1 ? width / (props.series.length - 1) : width
  const range = maxValue.value - minValue.value || 1

  return props.series.map((item, index) => {
    const x = Number((index * step).toFixed(2))
    const normalized = (item.value - minValue.value) / range
    const y = Number((bottom - normalized * (bottom - top)).toFixed(2))
    return { x, y }
  })
})

const linePath = computed(() => {
  if (points.value.length === 0) {
    return ''
  }
  return points.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
})

const areaPath = computed(() => {
  if (points.value.length === 0) {
    return ''
  }
  const lastPoint = points.value[points.value.length - 1]
  return `${linePath.value} L ${lastPoint.x} ${height} L 0 ${height} Z`
})

const markers = computed(() => {
  if (props.series.length < 3) {
    return props.series
  }
  const middleIndex = Math.floor((props.series.length - 1) / 2)
  return [props.series[0], props.series[middleIndex], props.series[props.series.length - 1]]
})
</script>

<template>
  <div class="trend-chart">
    <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient :id="`${chartId}-fill`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="accentStart" stop-opacity="0.34" />
          <stop offset="100%" :stop-color="accentEnd" stop-opacity="0.02" />
        </linearGradient>
        <linearGradient :id="`${chartId}-line`" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="accentStart" />
          <stop offset="100%" :stop-color="accentEnd" />
        </linearGradient>
      </defs>
      <path class="trend-chart__grid" d="M 0 38 L 100 38" />
      <path class="trend-chart__grid trend-chart__grid--faint" d="M 0 22 L 100 22" />
      <path :d="areaPath" :fill="`url(#${chartId}-fill)`" />
      <path :d="linePath" :stroke="`url(#${chartId}-line)`" class="trend-chart__line" />
      <circle
        v-for="(point, index) in points"
        :key="index"
        :cx="point.x"
        :cy="point.y"
        r="1.4"
        :fill="index === points.length - 1 ? accentStart : '#fbfffe'"
        class="trend-chart__dot"
      />
    </svg>

    <div class="trend-chart__axis">
      <span v-for="item in markers" :key="item.key">{{ item.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.trend-chart {
  display: grid;
  gap: 0.55rem;
}

svg {
  width: 100%;
  height: 13rem;
  display: block;
}

.trend-chart__grid {
  fill: none;
  stroke: rgba(17, 31, 43, 0.15);
  stroke-width: 0.6;
}

.trend-chart__grid--faint {
  stroke: rgba(17, 31, 43, 0.08);
  stroke-dasharray: 2 2;
}

.trend-chart__line {
  fill: none;
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.trend-chart__dot {
  stroke: rgba(17, 31, 43, 0.18);
  stroke-width: 0.5;
}

.trend-chart__axis {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: rgba(17, 31, 43, 0.64);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
</style>
