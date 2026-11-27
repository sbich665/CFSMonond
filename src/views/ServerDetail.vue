<script setup>
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import FieldPanel from '../components/FieldPanel.vue'
import MetricsChart from '../components/MetricsChart.vue'
import { useMonitor, canRead } from '../composables/useMonitor.js'
import { createBatchBuffer, useConnections, usePageActivity } from '../composables/usePageActivity.js'
import { HOURS } from '../utils/api.js'
import { adminUrl } from '../utils/config.js'
import { useLabels } from '../utils/i18n.js'
import { OFFLINE_AFTER_MS, PROBES, bytes, epochMillis, format, gpuDevices, isOnline, number, percent, probeRows, quotaBytes, timeLabel } from '../utils/metrics.js'

const route = useRoute()
const { sites, login, themeOptions } = useMonitor()
const { t, locale } = useLabels()
const id = String(route.params.id)
const siteIndex = route.query.site === undefined ? 0 : Number(route.query.site)
const site = Number.isInteger(siteIndex) ? sites[siteIndex] : undefined
const server = shallowRef(null)
const history = shallowRef([])
const now = ref(Date.now())
const currentError = ref(site ? '' : t('loadError'))
const historyError = ref('')
const fetchingHistory = ref(false)
const range = ref(0.167)
const { states, connect, disconnect } = useConnections()
const socketState = computed(() => states.get(site?.index))
const canUseRange = computed(() => HOURS.filter(hours => hours <= 24 || site?.config?.authorization === true))
const online = computed(() => server.value ? isOnline(server.value, now.value) : false)
const names = computed(() => site?.config ?? {})
const currentProbes = computed(() => server.value ? probeRows(server.value, names.value, t('timeout'), locale.value, true) : [])
let currentRequest
let historyRequest
let offlineTimer
let booted = false
let closed = false

function clockLabel(hours) {
  if (hours === 0.167) return t('tenMinutes')
  if (hours === 0.5) return t('thirtyMinutes')
  return hours >= 24 ? t('days', { days: hours / 24 }) : t('hours', { hours })
}

function historyRow(reading, timestamp) {
  return { ...reading, timestamp }
}

function updateClock() {
  clearTimeout(offlineTimer)
  now.value = Date.now()
  const last = epochMillis(server.value?.last_updated)
  const pending = last === null ? 0 : last + OFFLINE_AFTER_MS - now.value
  if (!document.hidden && pending > 0) offlineTimer = setTimeout(updateClock, Math.min(pending, 2_147_483_647))
}

const batch = createBatchBuffer(items => {
  if (!server.value || !items.length) return
  const patch = items[0].patch
  server.value = { ...server.value, ...patch }
  updateClock()
  const timestamp = patch.last_updated
  const cutoff = timestamp - range.value * 3_600_000
  const keep = history.value.filter(row => row.timestamp >= cutoff && row.timestamp !== timestamp)
  history.value = [...keep, historyRow(server.value, timestamp)].slice(-600)
})

function subscribe(userInitiated = false) {
  if (!site || !server.value || closed) return
  connect(site, id, [], updates => {
    for (const update of updates) {
      if (String(update?.serverId ?? '') === id) batch.add(site, server.value, update)
    }
  }, userInitiated)
}

async function loadCurrent() {
  if (!site || closed || document.hidden || currentRequest) return
  const request = new AbortController()
  currentRequest = request
  try {
    const result = await site.api.server(id, request.signal)
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid server response')
    if (closed) return
    server.value = result
    updateClock()
    currentError.value = ''
    subscribe()
  } catch (error) {
    if (!request.signal.aborted) currentError.value = error.message
  } finally {
    if (currentRequest === request) currentRequest = undefined
  }
}

async function loadHistory(hours) {
  if (!site || closed || !canUseRange.value.includes(hours)) return
  range.value = hours
  historyRequest?.abort()
  const request = new AbortController()
  historyRequest = request
  fetchingHistory.value = true
  historyError.value = ''
  try {
    const rows = await site.api.history(id, hours, request.signal)
    if (request.signal.aborted) return
    if (!Array.isArray(rows)) throw new Error('Invalid history response')
    history.value = rows.flatMap(row => {
      const timestamp = epochMillis(row.timestamp)
      return timestamp === null ? [] : [historyRow(row, timestamp)]
    }).sort((left, right) => left.timestamp - right.timestamp)
  } catch (error) {
    if (!request.signal.aborted) {
      history.value = []
      historyError.value = error.message
    }
  } finally {
    if (historyRequest === request) {
      fetchingHistory.value = false
      historyRequest = undefined
    }
  }
}

function activate() {
  if (!site?.config) {
    currentError.value = site?.configError?.message || t('loadError')
    return
  }
  if (!canRead(site)) {
    login(site.base)
    return
  }
  void loadCurrent()
  if (!booted) {
    booted = true
    void loadHistory(0.167)
  }
}

function suspend() {
  clearTimeout(offlineTimer)
  batch.clear()
  disconnect()
}

usePageActivity({ start: activate, resume: activate, suspend })
onUnmounted(() => {
  closed = true
  currentRequest?.abort()
  historyRequest?.abort()
})

const groups = {
  identity: ['id', 'name', 'server_group', 'region', 'tags', 'os', 'arch', 'kernel_version', 'boot_time', 'ip_v4', 'ip_v6', 'is_hidden', 'sort_order'],
  hardware: ['cpu', 'cpu_cores', 'cpu_info', 'load_avg', 'ram_total', 'ram_used', 'swap_total', 'swap_used', 'disk_total', 'disk_used', 'processes', 'tcp_conn', 'udp_conn'],
  network: ['interface', 'net_in_speed', 'net_out_speed', 'net_rx', 'net_tx', 'net_rx_monthly', 'net_tx_monthly', 'rx_correction', 'tx_correction'],
  billing: ['price', 'currency', 'billing_cycle', 'auto_renewal', 'expire_date', 'traffic_limit', 'traffic_calc_type', 'reset_day', 'traffic_alert_percent', 'traffic_alert_state', 'offline_notify_disabled'],
  probe: ['agent_version', 'collect_interval', 'report_interval', 'wss_report_interval', 'connection_mode', 'ping_mode', 'last_updated', 'timestamp', 'history_partition_id']
}
const handled = new Set([
  ...Object.values(groups).flat(), 'disk', 'gpu_info', 'latestReportUpdates', 'sysConfig',
  'note', 'bandwidth', 'auto_update',
  ...PROBES.flatMap(([id, target]) => ['ping_' + id, 'loss_' + id, target])
])
const capacities = new Set(['ram_total', 'ram_used', 'swap_total', 'swap_used', 'disk_total', 'disk_used'])
const traffic = new Set(['net_rx', 'net_tx', 'net_rx_monthly', 'net_tx_monthly', 'rx_correction', 'tx_correction'])

function fieldValue(key, value) {
  if (value === undefined || value === null) return '—'
  if (capacities.has(key)) return format(value, ' MB')
  if (traffic.has(key)) return bytes(value)
  if (['net_in_speed', 'net_out_speed', 'read_bps', 'write_bps'].includes(key)) return bytes(value, '/s')
  if (['cpu', 'util', 'traffic_alert_percent'].includes(key)) return format(value, '%')
  if (key === 'await_ms') return format(value, ' ms')
  if (key === 'traffic_limit') return bytes(quotaBytes(value))
  if (key === 'price' && [0, -1].includes(number(value))) return t('free')
  if (['boot_time', 'last_updated', 'timestamp'].includes(key)) return timeLabel(value, true)
  if (key === 'arch') return format(value)
  if (key === 'is_hidden') return t(value === '1' ? 'hidden' : 'shown')
  if (['ip_v4', 'ip_v6'].includes(key)) return t(value === '1' ? 'reachable' : 'unreachable')
  if (['auto_renewal', 'offline_notify_disabled'].includes(key)) return t(value === '1' ? 'enabled' : 'disabled')
  if (key === 'billing_cycle' || key === 'traffic_calc_type') return t(value === 'total' ? 'combined' : value)
  if (['collect_interval', 'report_interval', 'wss_report_interval'].includes(key)) return format(value, ' s')
  if (typeof value === 'object') return JSON.stringify(value)
  return format(value)
}

const fieldSets = computed(() => {
  const data = server.value
  if (!data) return []
  const result = Object.entries(groups).map(([name, keys]) => [name, keys
    .filter(key => Object.hasOwn(data, key))
    .map(key => [key, t(key === 'arch' ? 'architecture' : key === 'ip_v4' ? 'IPv4' : key === 'ip_v6' ? 'IPv6' : key), fieldValue(key, data[key])])])
  if (data.sysConfig) result.find(([name]) => name === 'probe')[1].push(
    ...Object.entries(data.sysConfig).map(([key, value]) => ['sysConfig.' + key, t(key), fieldValue(key, value)])
  )
  if (data.disk && typeof data.disk === 'object') {
    result.push(['io', Object.entries(data.disk).map(([key, value]) => ['disk.' + key, t(key), fieldValue(key, value)])])
  }
  if (Object.hasOwn(data, 'gpu_info')) {
    const gpus = gpuDevices(data.gpu_info)
    result.push(['GPU', gpus.length ? gpus.flatMap((gpu, index) => [
      ['gpu.' + index + '.id', 'GPU ID', format(gpu.id)],
      ['gpu.' + index + '.name', t('name'), format(gpu.name)],
      ['gpu.' + index + '.info', 'GPU', format(gpu.info, '%')]
    ]) : [['gpu_info', 'GPU', '—']]])
  }
  result.push(['fields', Object.entries(data).filter(([key]) => !handled.has(key))
    .map(([key, value]) => [key, t(key), fieldValue(key, value)])])
  return result
})

function line(label, getValue, retainMissing = false) {
  const values = history.value.map(row => {
    const raw = getValue(row)
    return [row.timestamp, number(raw), raw === null]
  })
  if (!retainMissing && !values.some(([, value, timeout]) => value !== null || timeout)) return null
  return { label, points: values.map(([stamp, value]) => [stamp, value]), timedOut: !retainMissing && values.at(-1)?.[2] === true }
}

const charts = computed(() => {
  const list = [
    { title: t('hardware'), unit: '%', max: 100, series: [
      line('CPU', row => row.cpu, true),
      line(t('memory'), row => percent(number(row.ram_used), number(row.ram_total)), true),
      line(t('swap'), row => number(row.swap_total) > 0 ? percent(number(row.swap_used), number(row.swap_total)) : undefined),
      line(t('disk'), row => number(row.disk_total) > 0 ? percent(number(row.disk_used), number(row.disk_total)) : undefined)
    ] },
    { title: t('speed'), unit: 'B/s', series: [
      line(t('up'), row => row.net_out_speed), line(t('down'), row => row.net_in_speed)
    ] },
    ...[['delay', 'ping_', ' ms'], ['loss', 'loss_', '%']].map(([label, prefix, unit]) => ({
      title: t(label), unit, series: PROBES.map(([key, , name, zh, en]) =>
        line(names.value[name] || (locale.value === 'zh' ? zh : en), row => row[prefix + key]))
    })),
    { title: t('io'), unit: 'B/s', series: [
      line(t('read_bps'), row => row.disk?.read_bps),
      line(t('write_bps'), row => row.disk?.write_bps)
    ] },
    { title: 'GPU', unit: '%', max: 100, series: gpuDevices(server.value?.gpu_info).map(({ id, name }) =>
      line(name || String(id), row => gpuDevices(row.gpu_info).find(gpu => gpu.id === id)?.info))
    }
  ]
  return list.map(chart => ({ ...chart, series: chart.series.filter(Boolean) })).filter(chart => chart.series.length)
})
</script>

<template>
  <div class="aqua-layout">
    <nav class="aqua-sidebar">
      <RouterLink class="aqua-side-button" :to="{ name: 'dashboard' }">{{ t('allServers') }}</RouterLink>
    </nav>
    <main class="aqua-main">
      <p v-if="currentError" class="aqua-state" role="alert">{{ t('loadError') }} · {{ t(currentError) }}</p>
      <p v-else-if="!server" class="aqua-state" role="status">{{ t('loading') }}</p>
      <p v-if="site?.config && !canRead(site)" class="aqua-state">{{ t('loginRequired') }} <a v-if="themeOptions.show_admin_link" :href="adminUrl(site.base)">{{ t('admin') }}</a></p>
      <template v-if="server">
        <div class="aqua-page-header aqua-detail-header">
          <div>
            <div class="aqua-detail-name">
              <h1>{{ server.name || id }}</h1>
              <span class="aqua-status"><i class="aqua-lamp" :class="{ 'is-offline': !online }"></i>{{ t(online ? 'online' : 'offline') }}</span>
            </div>
            <p class="aqua-detail-subtitle">{{ [server.arch, server.os, server.region].filter(Boolean).join(' · ') }}</p>
          </div>
          <RouterLink class="aqua-button" :to="{ name: 'dashboard' }">{{ t('back') }}</RouterLink>
        </div>
        <p v-if="socketState && socketState !== 'live'" class="aqua-state" role="status">
          {{ t(socketState) }}
          <button v-if="socketState === 'paused'" class="aqua-button" type="button" @click="subscribe(true)">{{ t('continue') }}</button>
        </p>
        <section class="aqua-panel aqua-history">
          <div class="aqua-panel-heading">
            <h2>{{ t('history') }}</h2>
            <label class="aqua-range-label">{{ t('range') }}
              <select class="aqua-range" :value="range" @change="loadHistory(Number($event.target.value))">
                <option v-for="hours of canUseRange" :key="hours" :value="hours">{{ clockLabel(hours) }}</option>
              </select>
            </label>
          </div>
          <p v-if="fetchingHistory" class="aqua-state" role="status">{{ t('loading') }}</p>
          <p v-else-if="historyError" class="aqua-state" role="alert">{{ t('loadError') }} · {{ t(historyError) }}</p>
          <div v-else class="aqua-history-charts">
            <MetricsChart v-for="chart of charts" :key="chart.title" v-bind="chart" />
          </div>
        </section>
        <div class="aqua-field-panels">
          <section v-if="currentProbes.length" class="aqua-panel aqua-section aqua-wide">
            <h2>{{ t('delay') }} / {{ t('loss') }}</h2>
            <div class="aqua-probes">
              <div class="aqua-probe-row aqua-probe-labels"><span>{{ t('line') }}</span><span>{{ t('target') }}</span><span>{{ t('delay') }}</span><span>{{ t('loss') }}</span></div>
              <div v-for="row of currentProbes" :key="row.id" class="aqua-probe-row">
                <span>{{ row.name }}</span><span>{{ row.address || '—' }}</span>
                <span :class="{ 'aqua-timeout': row.delayTimeout }">{{ row.delay || '—' }}</span>
                <span :class="{ 'aqua-timeout': row.lossTimeout }">{{ row.lossRate || '—' }}</span>
              </div>
            </div>
          </section>
          <FieldPanel v-for="[name, rows] of fieldSets" :key="name" :title="t(name)" :rows="rows" />
          <section v-if="Array.isArray(server.latestReportUpdates)" class="aqua-panel aqua-section aqua-wide">
            <h2>{{ t('reports') }}</h2>
            <div v-for="(report, index) of server.latestReportUpdates" :key="index" class="aqua-report">
              <dl class="aqua-fields">
                <div><dt>{{ t('id') }}</dt><dd>{{ report.serverId }}</dd></div>
                <div><dt>{{ t('reportTs') }}</dt><dd>{{ timeLabel(report.reportTs, true) }}</dd></div>
                <div><dt>{{ t('reportAge') }}</dt><dd>{{ format(report.reportAgeMs, ' ms') }}</dd></div>
              </dl>
              <div v-if="Array.isArray(report.samples)" class="aqua-sample-grid">
                <div v-for="(sample, position) of report.samples" :key="position" class="aqua-sample">
                  <h3>{{ timeLabel(sample.ts, true) }}</h3>
                  <dl class="aqua-fields">
                    <div v-for="(value, key) in sample.data || sample.payload || sample.metrics || {}" :key="key">
                      <dt>{{ t(key) }}</dt><dd>{{ fieldValue(key, value) }}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
    </main>
  </div>
</template>
