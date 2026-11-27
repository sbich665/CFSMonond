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
const route = computed(() => ({
  name: 'server', params: { id: String(server.value.id) },
  query: sites.length > 1 ? { site: String(props.site.index) } : undefined
}))
const metrics = computed(() => {
  const data = server.value
  const active = online.value
  const cores = number(data.cpu_cores)
  return [{
    key: 'cpu', label: 'CPU', percent: active ? number(data.cpu) : null,
    capacity: cores > 0 ? format(cores, ' ' + t('cores')) : '—'
  }, ...capacityRows(data).filter(([key]) => key !== 'traffic' || showTraffic.value).map(
    ([key, used, total, multiplier]) => ({
      key, label: t(key), percent: active || key === 'traffic' ? percent(used, total) : null,
      capacity: capacityLabel(active || key === 'traffic' ? used : null, total, multiplier)
    })
  )]
})
const connections = computed(() => [
  [t('processes'), 'processes'], ['TCP', 'tcp_conn'], ['UDP', 'udp_conn']
].map(([label, key]) => [label, format(online.value ? number(server.value[key]) : null)]))
const boot = computed(() => {
  const timestamp = epochMillis(server.value.boot_time)
  return timestamp === null ? null : {
    short: timeLabel(timestamp),
    full: timeLabel(timestamp, true),
    iso: new Date(timestamp).toISOString()
  }
})
const directions = computed(() => {
  const data = server.value
  const rates = [
    { key: 'up', arrow: '⬆️', speed: data.net_out_speed, total: data.net_tx },
    { key: 'down', arrow: '⬇️', speed: data.net_in_speed, total: data.net_rx }
  ]
  return themeOptions.value.speed_order === 'download-first' ? rates.reverse() : rates
})
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
  return (server.value.currency || '') + format(price) + ' / ' + t(server.value.billing_cycle || 'month')
})
const renewal = computed(() => expiry.value && ['0', '1'].includes(server.value.auto_renewal)
  ? t(server.value.auto_renewal === '1' ? 'renewOn' : 'renewOff')
  : '')

function progress(value) {
  return (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0) + '%'
}
</script>

<template>
  <article class="aqua-panel aqua-server">
    <header class="aqua-server-header">
      <div class="aqua-server-title">
        <h2><RouterLink class="aqua-server-link" :to="route">{{ server.name || server.id }}</RouterLink></h2>
        <span class="aqua-status"><i class="aqua-lamp" :class="{ 'is-offline': !online }"></i>{{ t(online ? 'online' : 'offline') }}</span>
      </div>
      <div class="aqua-server-meta">
        <p class="aqua-server-location">
          <span v-if="server.arch" class="aqua-arch" :title="t('architecture')">{{ server.arch }}</span>
          <span>{{ [server.os, server.region].filter(Boolean).join(' · ') }}</span>
        </p>
        <div class="aqua-server-tags">
          <span v-for="version in [4, 6]" :key="version" class="aqua-ip-tag"
            :data-reachable="server['ip_v' + version] === '1'"
            :aria-label="'IPv' + version + ' ' + t(server['ip_v' + version] === '1' ? 'reachable' : 'unreachable')"
          >IPv{{ version }} {{ server['ip_v' + version] === '1' ? '✓' : '×' }}</span>
          <span v-if="server.agent_version" class="aqua-agent">{{ t('agent') }} {{ server.agent_version }}</span>
        </div>
      </div>
    </header>
    <div class="aqua-server-usage">
      <div v-for="metric of metrics" :key="metric.key" class="aqua-measure" :data-metric="metric.key">
        <span>{{ metric.label }}</span>
        <span class="aqua-track" aria-hidden="true"><i :style="{ width: progress(metric.percent) }"></i></span>
        <b>{{ percentLabel(metric.percent) }}</b>
        <span class="aqua-measure-capacity">{{ metric.capacity }}</span>
      </div>
    </div>
    <div class="aqua-server-network">
      <dl class="aqua-server-connections">
        <div v-for="[label, value] of connections" :key="label"><dt>{{ label }}</dt><dd><b>{{ value }}</b></dd></div>
        <div v-if="boot"><dt class="aqua-sr-only">{{ t('boot') }}</dt><dd><time :datetime="boot.iso" :title="boot.full">{{ boot.short }}</time></dd></div>
      </dl>
      <dl class="aqua-transfer">
        <div v-for="direction of directions" :key="direction.key" class="aqua-transfer-direction" :data-direction="direction.key">
          <dt><span class="aqua-emoji-arrow" aria-hidden="true">{{ direction.arrow }}</span><span class="aqua-sr-only">{{ t(direction.key) }}</span></dt>
          <dd><span class="aqua-sr-only">{{ t('speed') }}</span><b>{{ online ? bytes(direction.speed, '/s') : '—' }}</b></dd>
          <dd v-if="showTraffic" class="aqua-transfer-total"><span class="aqua-sr-only">{{ t('transfer') }}</span><b>{{ bytes(direction.total) }}</b></dd>
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
  </article>
</template>
