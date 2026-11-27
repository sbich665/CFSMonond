<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ProbeMatrix from './ProbeMatrix.vue'
import { useMonitor } from '../composables/useMonitor.js'
import { useLabels } from '../utils/i18n.js'
import { bytes, capacityLabel, capacityRows, epochMillis, expiryInfo, format, isOnline,
  number, percent, percentLabel, probeRows, timeLabel } from '../utils/metrics.js'

const props = defineProps({
  row: { type: Object, required: true },
  site: { type: Object, required: true },
  now: { type: Number, required: true }
})
const { themeOptions, sites } = useMonitor()
const { t, locale } = useLabels()
const server = computed(() => props.row)
const online = computed(() => isOnline(server.value, props.now))
const switches = computed(() => props.site.list?.sysConfig ?? {})
const showTraffic = computed(() => switches.value.show_tf !== false)
const protocols = computed(() => [4, 6].filter(version => server.value['ip_v' + version] === '1'))
const agentVersion = computed(() => fieldText(server.value.agent_version))
const architecture = computed(() => fieldText(server.value.arch))
const location = computed(() => [server.value.os, server.value.region].map(fieldText).filter(Boolean).join(' · '))
const route = computed(() => ({
  name: 'server', params: { id: String(server.value.id) },
  query: sites.length > 1 ? { site: String(props.site.index) } : undefined
}))
const metrics = computed(() => {
  const data = server.value
  const cores = number(data.cpu_cores)
  return [{
    key: 'cpu', label: 'CPU', percent: nonNegative(data.cpu),
    capacity: cores > 0 ? format(cores, ' ' + t('cores')) : ''
  }, ...capacityRows(data).filter(([key]) => key !== 'traffic' || showTraffic.value).map(
    ([key, used, total, multiplier]) => {
      const current = nonNegative(used)
      return { key, label: t(key), percent: percent(current, total), capacity: capacityLabel(current, total, multiplier) }
    }
  )].filter(metric => metric.percent !== null || metric.capacity)
})
const connections = computed(() => [
  [t('processes'), 'processes'], ['TCP', 'tcp_conn'], ['UDP', 'udp_conn']
].flatMap(([label, key]) => {
  const value = nonNegative(server.value[key])
  return value === null ? [] : [[label, format(value)]]
}))
const boot = computed(() => {
  const value = server.value.boot_time
  const timestamp = epochMillis(value)
  return timestamp === null ? null : {
    label: timeLabel(value, true),
    iso: new Date(timestamp).toISOString()
  }
})
const directions = computed(() => {
  const data = server.value
  const total = value => showTraffic.value ? transferValue(value) : null
  const rates = [
    { key: 'up', arrow: '⬆️', speed: transferValue(data.net_out_speed, '/s'), total: total(data.net_tx) },
    { key: 'down', arrow: '⬇️', speed: transferValue(data.net_in_speed, '/s'), total: total(data.net_rx) }
  ].filter(direction => direction.speed || direction.total)
  return themeOptions.value.speed_order === 'download-first' ? rates.reverse() : rates
})
const hasNetwork = computed(() => Boolean(connections.value.length || boot.value || directions.value.length))
const paths = computed(() => switches.value.show_three_net_details === true
  ? probeRows(server.value, props.site.config, t('timeout'), locale.value).slice(0, themeOptions.value.three_net_panel_count)
  : [])
const expiry = computed(() => switches.value.show_expire !== false ? expiryInfo(server.value.expire_date, props.now) : null)
const expiryText = computed(() => {
  const days = expiry.value?.days
  if (days === undefined) return ''
  if (days === 0) return t('expiresToday')
  return t(days > 0 ? 'daysLeft' : 'daysPast', { days: Math.abs(days) })
})
const fee = computed(() => {
  if (switches.value.show_price === false) return ''
  const price = number(server.value.price)
  if (price === 0 || price === -1) return t('free')
  if (price === null || price < 0) return ''
  const period = server.value.billing_cycle
  return (server.value.currency || '') + format(price) + (period ? ' / ' + t(period) : '')
})
const renewal = computed(() => expiry.value && ['0', '1'].includes(server.value.auto_renewal)
  ? t(server.value.auto_renewal === '1' ? 'renewOn' : 'renewOff')
  : '')

function fieldText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function nonNegative(value) {
  const reading = number(value)
  return reading !== null && reading >= 0 ? reading : null
}

function transferValue(value, suffix = '') {
  const reading = nonNegative(value)
  return reading === null ? null : { full: bytes(reading, suffix), compact: bytes(reading, suffix, true) }
}

function capacityText(label) {
  return label.replaceAll(' ', '\u00a0').replace('\u00a0/\u00a0', ' /\u00a0')
}

function progress(value) {
  return (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0) + '%'
}
</script>

<template>
  <article class="aqua-panel aqua-server">
    <header class="aqua-server-header">
      <h2><RouterLink class="aqua-server-link" :to="route" :title="server.name || String(server.id)">{{ server.name || server.id }}</RouterLink></h2>
      <span class="aqua-status"><i class="aqua-lamp" :class="{ 'is-offline': !online }"></i>{{ t(online ? 'online' : 'offline') }}</span>
      <p v-if="architecture || location" class="aqua-server-location">
        <span v-if="architecture" class="aqua-arch" :title="t('architecture') + ' ' + architecture">{{ architecture }}</span>
        <span v-if="location" :title="location">{{ location }}</span>
      </p>
      <div v-if="protocols.length || agentVersion" class="aqua-server-tags">
        <span v-for="version in protocols" :key="version" class="aqua-ip-tag"
          :title="'IPv' + version + ' ' + t('reachable')"
        >v{{ version }}</span>
        <span v-if="agentVersion" class="aqua-agent" :title="agentVersion">{{ agentVersion }}</span>
      </div>
    </header>
    <div class="aqua-server-body">
      <div v-if="metrics.length" class="aqua-server-usage">
        <div v-for="metric of metrics" :key="metric.key" class="aqua-measure" :data-metric="metric.key">
          <span>{{ metric.label }}</span>
          <span v-if="metric.percent !== null" class="aqua-track" aria-hidden="true"><i :style="{ width: progress(metric.percent) }"></i></span>
          <b v-if="metric.percent !== null" class="aqua-measure-value">{{ percentLabel(metric.percent) }}</b>
          <span v-if="metric.capacity" class="aqua-measure-capacity" :title="metric.capacity">{{ capacityText(metric.capacity) }}</span>
        </div>
      </div>
      <div v-if="hasNetwork || paths.length || expiry || fee" class="aqua-server-details">
        <div v-if="hasNetwork" class="aqua-server-network">
          <dl v-if="connections.length || boot" class="aqua-server-connections">
            <div v-for="[label, value] of connections" :key="label"><dt>{{ label }}</dt><dd><b>{{ value }}</b></dd></div>
            <div v-if="boot"><dt class="aqua-sr-only">{{ t('boot') }}</dt><dd><time :datetime="boot.iso">{{ boot.label }}</time></dd></div>
          </dl>
          <dl v-if="directions.length" class="aqua-transfer">
            <div v-for="direction of directions" :key="direction.key" class="aqua-transfer-direction" :data-direction="direction.key">
              <dt><span class="aqua-emoji-arrow" aria-hidden="true">{{ direction.arrow }}</span><span class="aqua-sr-only">{{ t(direction.key) }}</span></dt>
              <dd v-if="direction.speed">
                <span class="aqua-sr-only">{{ t('speed') }}</span>
                <b :title="direction.speed.full">
                  <span class="aqua-transfer-full">{{ direction.speed.full }}</span>
                  <span class="aqua-transfer-compact">{{ direction.speed.compact }}</span>
                </b>
              </dd>
              <dd v-if="direction.total" class="aqua-transfer-total">
                <span class="aqua-sr-only">{{ t('transfer') }}</span>
                <b :title="direction.total.full">
                  <span class="aqua-transfer-full">{{ direction.total.full }}</span>
                  <span class="aqua-transfer-compact">{{ direction.total.compact }}</span>
                </b>
              </dd>
            </div>
          </dl>
        </div>
        <ProbeMatrix :rows="paths" />
        <footer v-if="expiry || fee" class="aqua-card-billing">
          <span v-if="expiry" class="aqua-expiry">
            <span>{{ t('expires') }} <time :datetime="expiry.date">{{ expiry.date }}</time></span>
            <span class="aqua-expiry-days" :class="{ 'aqua-timeout': expiry.days < 0 }">{{ expiryText }}</span>
          </span>
          <span v-if="fee">{{ t('fee') }} <b>{{ fee }}</b></span>
          <span v-if="renewal">{{ renewal }}</span>
        </footer>
      </div>
    </div>
  </article>
</template>
