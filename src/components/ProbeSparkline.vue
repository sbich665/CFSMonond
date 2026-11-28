<script setup>
import { computed, ref, watchPostEffect } from 'vue'
import { useLabels } from '../utils/i18n.js'

const props = defineProps({
  kind: { type: String, required: true },
  name: { type: String, required: true },
  trend: { type: Object, required: true }
})
const { t } = useLabels()
const canvas = ref(null)
const label = computed(() => props.name + ' · ' + t(props.kind === 'delay' ? 'delayTrace' : 'lossTrace'))

watchPostEffect(() => {
  const target = canvas.value
  const context = target?.getContext('2d')
  if (!context) return
  const { width, height } = target
  const { delay, loss, maxGap } = props.trend
  const times = [...delay.points, ...loss.points].map(point => point.time)
  const start = Math.min(...times)
  const span = Math.max(...times) - start
  const points = props.trend[props.kind].points
  const values = points.map(point => point.value).filter(value => value !== null)
  const latency = props.kind === 'delay'
  const min = latency ? Math.min(...values) : 0
  const max = latency ? Math.max(...values) : 100
  const inset = 5
  context.clearRect(0, 0, width, height)
  context.lineWidth = 3.6
  context.lineCap = 'round'
  context.lineJoin = 'round'

  context.beginPath()
  context.strokeStyle = latency ? '#1878dd' : '#c07629'
  context.setLineDash(latency ? [] : [6, 4])
  let previous = null
  for (const { time, value } of points) {
    if (value === null) {
      previous = null
      continue
    }
    const x = inset + (width - 2 * inset) * (span ? (time - start) / span : 0.5)
    const y = height - inset - (height - 2 * inset) * (max > min ? (value - min) / (max - min) : 0.5)
    if (previous === null || time - previous > maxGap) {
      context.moveTo(x, y)
      context.lineTo(x + 0.01, y)
    } else {
      context.lineTo(x, y)
    }
    previous = time
  }
  context.stroke()
})
</script>

<template>
  <canvas ref="canvas" class="aqua-probe-sparkline" width="132" height="44"
    role="img" :aria-label="label" :title="label"
  ></canvas>
</template>
