<script setup>
import { computed, watch } from 'vue'
import { useMonitor } from '../composables/useMonitor.js'
import { useLabels } from '../utils/i18n.js'
import { bytes, format, overviewStats } from '../utils/metrics.js'

const props = defineProps({ now: { type: Number, required: true } })
const { entries, ratePeaks, themeOptions } = useMonitor()
const { t } = useLabels()
const stats = computed(() => overviewStats(entries.value, props.now))
const arrows = { up: '⬆️', down: '⬇️' }

function peak(previous, reading) {
  return reading !== null && (previous === null || reading > previous) ? reading : previous
}

watch(stats, ({ download, upload }) => {
  const previous = ratePeaks.value
  const next = { download: peak(previous.download, download), upload: peak(previous.upload, upload) }
  if (next.download !== previous.download || next.upload !== previous.upload) ratePeaks.value = next
}, { immediate: true })

function byteReadings(readings, suffix = '') {
  return readings.filter(([, value]) => value !== null).map(([key, value]) => [key, bytes(value, suffix, true), bytes(value, suffix)])
}

function directions({ download, upload }) {
  const readings = [['up', upload], ['down', download]]
  return themeOptions.value.speed_order === 'download-first' ? readings.reverse() : readings
}

function trafficReadings(traffic) {
  const { download, upload } = traffic
  if (download === null && upload === null) return []
  const readings = byteReadings([['summaryTotal', (download ?? 0) + (upload ?? 0)], ...directions(traffic)])
  const unit = ' ' + readings[0][1].split(' ').at(-1)
  if (!readings.every(([, value]) => value.endsWith(unit))) return readings
  return readings.map(([key, value, title]) => [key, key === 'summaryTotal' ? value : value.slice(0, -unit.length), title])
}

const panels = computed(() => {
  const { total, online, ipv4Only, ipv6Only, dualStack, bootTraffic, periodTraffic } = stats.value
  return [
    ['onlineNodes', [['', [
      ['onlineOfTotal', format(online) + '/' + format(total)], ['offline', format(total - online)],
      ['ipv4Only', format(ipv4Only)], ['ipv6Only', format(ipv6Only)], ['dualStack', format(dualStack)]
    ]]]],
    ['realtimeNetwork', [
      ['currentRate', byteReadings(directions(stats.value), '/s')],
      ['peakRate', byteReadings(directions(ratePeaks.value), '/s')]
    ]],
    ['trafficSummary', [
      ['bootTraffic', trafficReadings(bootTraffic)], ['periodTraffic', trafficReadings(periodTraffic)]
    ]]
  ].map(([heading, groups]) => [heading, groups.filter(([, readings]) => readings.length)])
})
</script>

<template>
  <div class="aqua-overview-summary">
    <section v-for="[heading, groups] of panels" :key="heading" class="aqua-summary-panel"
      :data-summary="heading" :aria-label="t(heading)" tabindex="0"
    >
      <template v-if="groups.length">
        <div v-for="[label, readings] of groups" :key="label" class="aqua-summary-group" :data-summary-group="label">
          <h2 v-if="label" class="aqua-summary-caption" :title="t(label === 'peakRate' ? 'peakRateHint' : label)">{{ t(label) }}</h2>
          <dl class="aqua-summary-fields">
            <div v-for="[key, value, title] of readings" :key="key" :data-reading="key">
              <dt :title="t(key)" :class="{ 'aqua-sr-only': key === 'summaryTotal' }">
                <template v-if="arrows[key]"><span class="aqua-emoji-arrow" aria-hidden="true">{{ arrows[key] }}</span><span class="aqua-sr-only">{{ t(key) }}</span></template>
                <template v-else>{{ t(key) }}</template>
              </dt>
              <dd :title="title || value" :aria-label="title">{{ value }}</dd>
            </div>
          </dl>
        </div>
      </template>
      <p v-else class="aqua-summary-empty">{{ t('notReported') }}</p>
    </section>
  </div>
</template>
