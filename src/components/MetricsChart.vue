<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { bytes, format } from '../utils/metrics.js'
import { useLabels } from '../utils/i18n.js'

const props = defineProps({
  title: { type: String, required: true },
  series: { type: Array, required: true },
  unit: { type: String, default: '' },
  max: { type: Number, default: null }
})
const { t } = useLabels()
const canvas = ref(null)
const colors = ['#1777e7', '#07867d', '#b8651a', '#9552c5', '#d24859', '#116eae', '#6c801d', '#9e5b45']
const points = computed(() => props.series.flatMap(line => line.points))
const scale = computed(() => props.max ?? Math.max(1, ...points.value.map(point => point[1] ?? 0)))
const domain = computed(() => {
  const time = points.value.map(point => point[0])
  return time.length ? [Math.min(...time), Math.max(...time)] : []
})
const endPoints = computed(() => domain.value.map(value => new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
}).format(value)))
let observer

function tick(value) {
  return props.unit === 'B/s' ? bytes(value, '/s') : format(value, props.unit)
}

function paint() {
  const target = canvas.value
  if (!target || !domain.value.length) return
  const { clientWidth: width, clientHeight: height } = target
  if (!width || !height) return
  const ratio = Math.min(devicePixelRatio || 1, 2)
  target.width = Math.round(width * ratio)
  target.height = Math.round(height * ratio)
  const context = target.getContext('2d')
  const [start, end] = domain.value
  context.scale(ratio, ratio)
  context.lineWidth = 1.7
  context.lineJoin = 'round'
  props.series.forEach((line, index) => {
    context.beginPath()
    let pen = false
    for (const [timestamp, value] of line.points) {
      if (value === null) {
        pen = false
        continue
      }
      const x = 1 + (width - 2) * (end === start ? 0.5 : (timestamp - start) / (end - start))
      const y = height - 2 - (height - 4) * Math.min(1, Math.max(0, value / scale.value))
      if (!pen) context.moveTo(x, y)
      else context.lineTo(x, y)
      context.lineTo(x + 0.01, y)
      pen = true
    }
    context.strokeStyle = colors[index % colors.length]
    context.stroke()
  })
}

onMounted(() => {
  observer = new ResizeObserver(paint)
  observer.observe(canvas.value)
  paint()
})
watch(() => props.series, async () => { await nextTick(); paint() })
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="aqua-chart-panel">
    <h3>{{ title }}</h3>
    <div class="aqua-chart-legend">
      <span v-for="(line, index) of series" :key="line.label">
        <i :style="{ background: colors[index % colors.length] }"></i>{{ line.label }}{{ line.timedOut ? ' · ' + t('timeout') : '' }}
      </span>
    </div>
    <div v-show="points.length" class="aqua-chart">
      <div class="aqua-y-axis">
        <span v-for="value of [scale, scale / 2, 0]" :key="value" :title="tick(value)">{{ tick(value) }}</span>
      </div>
      <canvas ref="canvas" class="aqua-trend" role="img" :aria-label="title"></canvas>
      <div class="aqua-x-axis"><span v-for="(point, index) of endPoints" :key="index">{{ point }}</span></div>
    </div>
    <p v-if="!points.length" class="aqua-detail-subtitle">{{ t('emptyHistory') }}</p>
  </div>
</template>
