<script setup>
import { computed } from 'vue'
import { useMonitor } from '../composables/useMonitor.js'
import { useLabels } from '../utils/i18n.js'
import { bytes, format, overviewStats } from '../utils/metrics.js'

const props = defineProps({ now: { type: Number, required: true } })
const { entries } = useMonitor()
const { t } = useLabels()
const stats = computed(() => overviewStats(entries.value, props.now))

function byteReadings(readings, suffix = '') {
  return readings.filter(([, value]) => value !== null).map(([key, value]) => [key, bytes(value, suffix, true), bytes(value, suffix)])
}

const panels = computed(() => {
  const { total, online, ipv4Only, ipv6Only, dualStack, download, upload, bootTraffic, periodTraffic } = stats.value
  return [
    ['onlineNodes', [
      [['onlineOfTotal', format(online) + '/' + format(total)], ['offline', format(total - online)]],
      [['ipv4Only', format(ipv4Only)], ['ipv6Only', format(ipv6Only)], ['dualStack', format(dualStack)]]
    ]],
    ['realtimeNetwork', [byteReadings([
      ['down', download], ['up', upload], ['rateTotal', download === null || upload === null ? null : download + upload]
    ], '/s')]],
    ['trafficSummary', [byteReadings([['bootTraffic', bootTraffic], ['periodTraffic', periodTraffic]])]]
  ]
})
</script>

<template>
  <div class="aqua-overview-summary">
    <section v-for="[heading, groups] of panels" :key="heading" class="aqua-summary-panel" :data-summary="heading">
      <h2 :title="t(heading)">{{ t(heading) }}</h2>
      <template v-if="groups[0].length">
        <dl v-for="readings of groups" :key="readings[0][0]" class="aqua-summary-fields">
          <div v-for="[key, value, title] of readings" :key="key" :data-reading="key">
            <dt :title="t(key)">{{ t(key) }}</dt>
            <dd :title="title || value">{{ value }}</dd>
          </div>
        </dl>
      </template>
      <p v-else class="aqua-summary-empty">{{ t('notReported') }}</p>
    </section>
  </div>
</template>
