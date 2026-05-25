<script setup lang="ts">
import { computed, ref } from 'vue'

type DataPoint = {
  key: string
  label: string
  value: number
}

type TrendChartCopy = {
  latest: string
  total: string
  peak: string
  low: string
  hoverHint: string
}

const props = defineProps<{
  series: DataPoint[]
  accentStart: string
  accentEnd: string
  locale: 'en' | 'zh'
  valueUnit: string
  deltaLabel: string
  windowLabel: string
  copy: TrendChartCopy
}>()

const chartWidth = 640
const chartHeight = 288
const plot = {
  top: 24,
  right: 18,
  bottom: 38,
  left: 56
}
const plotWidth = chartWidth - plot.left - plot.right
const plotHeight = chartHeight - plot.top - plot.bottom
const hoveredPointIndex = ref<number | null>(null)

const localeCode = computed(() => (props.locale === 'zh' ? 'zh-CN' : 'en-US'))

const compactFormatter = computed(
  () =>
    new Intl.NumberFormat(localeCode.value, {
      notation: 'compact',
      maximumFractionDigits: 1
    })
)

const fullFormatter = computed(
  () =>
    new Intl.NumberFormat(localeCode.value, {
      maximumFractionDigits: 0
    })
)

const latestPoint = computed(() => props.series[props.series.length - 1] ?? null)
const previousPoint = computed(() => props.series[props.series.length - 2] ?? null)
const startingPoint = computed(() => props.series[0] ?? null)

const peakPoint = computed(() => {
  if (props.series.length === 0) {
    return null
  }

  return props.series.reduce((peak, point) => (point.value >= peak.value ? point : peak))
})

const lowPoint = computed(() => {
  if (props.series.length === 0) {
    return null
  }

  return props.series.reduce((low, point) => (point.value <= low.value ? point : low))
})

const deltaValue = computed(() => {
  if (!latestPoint.value || !previousPoint.value) {
    return null
  }

  return latestPoint.value.value - previousPoint.value.value
})

const totalValue = computed(() => {
  if (!latestPoint.value || !startingPoint.value) {
    return null
  }

  return latestPoint.value.value - startingPoint.value.value
})

const visibleAxisIndices = computed(() => {
  if (props.series.length <= 3) {
    return new Set(props.series.map((_, index) => index))
  }

  const middleIndex = Math.floor((props.series.length - 1) / 2)
  return new Set([0, middleIndex, props.series.length - 1])
})

const chartAriaLabel = computed(() => {
  if (!latestPoint.value) {
    return props.windowLabel
  }

  return `${props.windowLabel}, ${props.copy.latest} ${fullFormatter.value.format(latestPoint.value.value)} ${props.valueUnit}`
})

const valueRange = computed(() => {
  if (props.series.length === 0) {
    return {
      min: 0,
      max: 1
    }
  }

  const values = props.series.map((item) => item.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = maxValue - minValue
  const padding = range === 0 ? Math.max(1, Math.round(maxValue * 0.12) || 1) : range * 0.16

  return {
    min: Math.max(0, minValue - padding),
    max: maxValue + padding
  }
})

const chartPoints = computed(() => {
  const range = valueRange.value.max - valueRange.value.min || 1
  const lastIndex = Math.max(1, props.series.length - 1)

  return props.series.map((item, index) => {
    const x = props.series.length === 1 ? plot.left + plotWidth / 2 : plot.left + (plotWidth * index) / lastIndex
    const y = plot.top + (1 - (item.value - valueRange.value.min) / range) * plotHeight

    return {
      ...item,
      x,
      y
    }
  })
})

const hoveredPoint = computed(() => {
  const index = hoveredPointIndex.value
  return typeof index === 'number' ? chartPoints.value[index] ?? null : null
})

const trendPath = computed(() =>
  chartPoints.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
)

const areaPath = computed(() => {
  if (chartPoints.value.length === 0) {
    return ''
  }

  const baseline = plot.top + plotHeight
  const [first] = chartPoints.value
  const last = chartPoints.value[chartPoints.value.length - 1]

  return [
    trendPath.value,
    `L ${last.x.toFixed(2)} ${baseline.toFixed(2)}`,
    `L ${first.x.toFixed(2)} ${baseline.toFixed(2)}`,
    'Z'
  ].join(' ')
})

const axisPoints = computed(() =>
  chartPoints.value.filter((_, index) => visibleAxisIndices.value.has(index))
)

const gradientKey = computed(() =>
  [props.windowLabel, props.accentStart, props.accentEnd]
    .join('-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 72)
)

const lineGradientId = computed(() => `trend-line-${gradientKey.value}`)
const areaGradientId = computed(() => `trend-area-${gradientKey.value}`)

const tooltipStyle = computed(() => {
  if (!hoveredPoint.value) {
    return {}
  }

  const leftPercent = Math.min(86, Math.max(14, (hoveredPoint.value.x / chartWidth) * 100))
  const topPercent = (hoveredPoint.value.y / chartHeight) * 100

  return {
    left: `${leftPercent}%`,
    top: `${topPercent}%`
  }
})

const formatDelta = (value: number | null) => {
  if (value === null) {
    return 'N/A'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${compactFormatter.value.format(value)}`
}

const formatTrendTone = (value: number | null) => {
  if (value === null) {
    return 'trend-chart__pill-value--neutral'
  }

  if (value > 0) {
    return 'trend-chart__pill-value--positive'
  }

  if (value < 0) {
    return 'trend-chart__pill-value--negative'
  }

  return 'trend-chart__pill-value--neutral'
}

const handleChartPointerMove = (event: PointerEvent) => {
  if (chartPoints.value.length === 0) {
    hoveredPointIndex.value = null
    return
  }

  const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
  const relativeX = ((event.clientX - bounds.left) / bounds.width) * chartWidth
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  chartPoints.value.forEach((point, index) => {
    const distance = Math.abs(point.x - relativeX)
    if (distance < nearestDistance) {
      nearestIndex = index
      nearestDistance = distance
    }
  })

  hoveredPointIndex.value = nearestIndex
}

const clearHoveredPoint = () => {
  hoveredPointIndex.value = null
}
</script>

<template>
  <div class="trend-chart">
    <div class="trend-chart__summary">
      <div class="trend-chart__summary-primary">
        <span class="trend-chart__summary-kicker">{{ copy.latest }}</span>
        <div class="trend-chart__summary-value">
          <strong>{{ latestPoint ? fullFormatter.format(latestPoint.value) : 'N/A' }}</strong>
          <span>{{ valueUnit }}</span>
        </div>
        <span class="trend-chart__summary-context">{{ windowLabel }}</span>
      </div>

      <div class="trend-chart__summary-pills">
        <span class="trend-chart__pill">
          <strong :class="['trend-chart__pill-value', formatTrendTone(deltaValue)]">
            {{ formatDelta(deltaValue) }}
          </strong>
          <span>{{ deltaLabel }}</span>
        </span>

        <span class="trend-chart__pill">
          <strong :class="['trend-chart__pill-value', formatTrendTone(totalValue)]">
            {{ formatDelta(totalValue) }}
          </strong>
          <span>{{ copy.total }}</span>
        </span>

        <span class="trend-chart__pill">
          <strong class="trend-chart__pill-value">
            {{ peakPoint ? compactFormatter.format(peakPoint.value) : 'N/A' }}
          </strong>
          <span>{{ copy.peak }}</span>
        </span>
      </div>
    </div>

    <div class="trend-chart__frame" :style="{ '--trend-accent': accentStart }">
      <svg
        class="trend-chart__svg"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        role="img"
        :aria-label="chartAriaLabel"
        @pointermove="handleChartPointerMove"
        @pointerleave="clearHoveredPoint"
      >
        <defs>
          <linearGradient :id="lineGradientId" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" :stop-color="accentStart" />
            <stop offset="100%" :stop-color="accentEnd" />
          </linearGradient>
          <linearGradient :id="areaGradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="accentStart" stop-opacity="0.28" />
            <stop offset="100%" :stop-color="accentEnd" stop-opacity="0.04" />
          </linearGradient>
        </defs>

        <path v-if="areaPath" class="trend-chart__area" :d="areaPath" :fill="`url(#${areaGradientId})`" />
        <path v-if="trendPath" class="trend-chart__line" :d="trendPath" :stroke="`url(#${lineGradientId})`" />

        <g v-if="hoveredPoint" class="trend-chart__hover-guide" aria-hidden="true">
          <line
            :x1="hoveredPoint.x"
            :x2="hoveredPoint.x"
            :y1="plot.top"
            :y2="plot.top + plotHeight"
          />
          <circle :cx="hoveredPoint.x" :cy="hoveredPoint.y" r="8" />
        </g>

        <circle
          v-if="chartPoints.length > 0"
          class="trend-chart__latest-point"
          :cx="chartPoints[chartPoints.length - 1].x"
          :cy="chartPoints[chartPoints.length - 1].y"
          r="7"
        />

        <g class="trend-chart__x-axis" aria-hidden="true">
          <text
            v-for="point in axisPoints"
            :key="`axis-${point.key}`"
            :x="point.x"
            :y="chartHeight - 12"
            text-anchor="middle"
          >
            {{ point.label }}
          </text>
        </g>
      </svg>

      <div
        v-if="hoveredPoint"
        class="trend-chart__tooltip"
        :style="tooltipStyle"
        role="status"
      >
        <span>{{ hoveredPoint.label }}</span>
        <strong>{{ fullFormatter.format(hoveredPoint.value) }}</strong>
        <em>{{ valueUnit }}</em>
      </div>
    </div>

    <div class="trend-chart__footer">
      <span>
        {{ copy.low }}
        {{ lowPoint ? compactFormatter.format(lowPoint.value) : 'N/A' }}
      </span>
      <span>{{ copy.hoverHint }}</span>
    </div>
  </div>
</template>

<style scoped>
.trend-chart {
  display: grid;
  gap: 0.95rem;
}

.trend-chart__summary {
  display: grid;
  gap: 0.9rem;
}

.trend-chart__summary-primary {
  display: grid;
  gap: 0.38rem;
}

.trend-chart__summary-kicker,
.trend-chart__summary-context,
.trend-chart__pill span,
.trend-chart__footer {
  color: rgba(16, 34, 52, 0.6);
}

.trend-chart__summary-kicker {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.trend-chart__summary-value {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  color: #102234;
}

.trend-chart__summary-value strong {
  font-size: clamp(2rem, 4vw, 2.8rem);
  line-height: 0.95;
  letter-spacing: 0;
}

.trend-chart__summary-value span {
  font-size: 0.92rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.trend-chart__summary-context {
  font-size: 0.82rem;
}

.trend-chart__summary-pills {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.trend-chart__pill {
  display: grid;
  gap: 0.2rem;
  padding: 0.7rem 0.85rem;
  border-radius: 16px;
  border: 1px solid rgba(16, 34, 52, 0.08);
  background: rgba(255, 255, 255, 0.76);
}

.trend-chart__pill span {
  font-size: 0.76rem;
  line-height: 1.45;
}

.trend-chart__pill-value {
  font-size: 1.02rem;
  color: #102234;
}

.trend-chart__pill-value--positive {
  color: #0f766e;
}

.trend-chart__pill-value--negative {
  color: #c2410c;
}

.trend-chart__pill-value--neutral {
  color: #102234;
}

.trend-chart__frame {
  position: relative;
  overflow: visible;
  border-radius: 22px;
  border: 1px solid rgba(16, 34, 52, 0.08);
  background:
    radial-gradient(circle at top left, rgba(249, 115, 22, 0.08), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(245, 249, 252, 0.94));
}

.trend-chart__svg {
  display: block;
  width: 100%;
  height: 18rem;
}

.trend-chart__x-axis text {
  fill: rgba(16, 34, 52, 0.56);
  font-size: 0.72rem;
}

.trend-chart__area {
  pointer-events: none;
}

.trend-chart__line {
  fill: none;
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.trend-chart__hover-guide {
  pointer-events: none;
}

.trend-chart__hover-guide line {
  stroke: rgba(16, 34, 52, 0.24);
  stroke-dasharray: 5 7;
  stroke-width: 1.4;
}

.trend-chart__hover-guide circle {
  fill: var(--trend-accent);
  stroke: #ffffff;
  stroke-width: 3;
  filter: drop-shadow(0 8px 14px rgba(16, 34, 52, 0.24));
}

.trend-chart__latest-point {
  fill: var(--trend-accent);
  stroke: #ffffff;
  stroke-width: 3;
  filter: drop-shadow(0 6px 10px rgba(16, 34, 52, 0.24));
  pointer-events: none;
}

.trend-chart__tooltip {
  position: absolute;
  z-index: 2;
  display: grid;
  min-width: 9rem;
  gap: 0.18rem;
  padding: 0.72rem 0.82rem;
  border-radius: 12px;
  color: #f8fafc;
  background: rgba(8, 15, 28, 0.94);
  box-shadow: 0 18px 34px rgba(2, 6, 23, 0.24);
  transform: translate(-50%, calc(-100% - 0.75rem));
  pointer-events: none;
}

.trend-chart__tooltip span,
.trend-chart__tooltip em {
  color: rgba(226, 232, 240, 0.76);
  font-size: 0.74rem;
  font-style: normal;
}

.trend-chart__tooltip strong {
  font-size: 1.28rem;
  line-height: 1;
  letter-spacing: 0;
}

.trend-chart__footer {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  font-size: 0.79rem;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .trend-chart__summary-pills {
    grid-template-columns: 1fr;
  }

  .trend-chart__svg {
    height: 15rem;
  }

  .trend-chart__footer {
    display: grid;
  }
}
</style>
