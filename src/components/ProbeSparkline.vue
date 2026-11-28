<script setup>
import { computed, ref, watchPostEffect } from 'vue'
import { useLabels } from '../utils/i18n.js'

const props = defineProps({
  name: { type: String, required: true },
  trend: { type: Object, required: true }
})
const { t } = useLabels()
const canvas = ref(null)
const label = computed(() => [props.name, t('probeTrend'),
  props.trend.delay.points.length && t('delayTrace'),
  props.trend.loss.points.length && t('lossTrace')
].filter(Boolean).join(' · '))

watchPostEffect(() => {
  const target = canvas.value
  const context = target?.getContext('2d')
  if (!context) return
  const { width, height } = target
  const { delay, loss, maxGap } = props.trend
  const times = [...delay.points, ...loss.points].map(point => point.time)
  const start = Math.min(...times)
  const span = Math.max(...times) - start
  const inset = 5
  context.clearRect(0, 0, width, height)
  context.lineWidth = 3.6
  context.lineCap = 'round'
  context.lineJoin = 'round'

  function draw(points, min, max, color, dash) {
    context.beginPath()
    context.strokeStyle = color
    context.setLineDash(dash)
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
  }

  draw(loss.points, 0, 100, '#c07629', [8, 5])
  const delays = delay.points.map(point => point.value).filter(value => value !== null)
  if (delays.length) draw(delay.points, Math.min(...delays), Math.max(...delays), '#1878dd', [])
})
</script>

<template>
  <canvas ref="canvas" class="aqua-probe-sparkline" width="192" height="56"
    role="img" :aria-label="label" :title="label"
  ></canvas>
</template>
