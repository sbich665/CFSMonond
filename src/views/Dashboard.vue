<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import LiveStatus from '../components/LiveStatus.vue'
import OverviewSummary from '../components/OverviewSummary.vue'
import ServerCard from '../components/ServerCard.vue'
import { useMonitor, canRead } from '../composables/useMonitor.js'
import { createBatchBuffer, useConnections, usePageActivity } from '../composables/usePageActivity.js'
import { adminUrl } from '../utils/config.js'
import { useLabels } from '../utils/i18n.js'
import { subscribedIds, ID_LIMIT } from '../utils/live.js'
import { epochMillis, fieldText, OFFLINE_AFTER_MS } from '../utils/metrics.js'

const props = defineProps({
  selection: { type: Object, default: null },
  sidebarVisible: { type: Boolean, required: true }
})
defineEmits(['toggle-sidebar'])

const { sites, entries, login, list, themeOptions } = useMonitor()
const { t } = useLabels()
const search = ref('')
const now = ref(Date.now())
const { states, connect, disconnect, stayDisconnected } = useConnections()
let alive = true
let clock

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  const filter = props.selection
  return entries.value.filter(({ row }) => (!filter || fieldText(row[filter.field]) === filter.name) &&
    [row.name, row.region, row.server_group, row.os, row.tags].some(value => String(value ?? '').toLowerCase().includes(query)))
})
const loading = computed(() => sites.some(site => Boolean(site.listInFlight)))

function updateClock() {
  clearTimeout(clock)
  if (document.hidden) return
  now.value = Date.now()
  const midnight = new Date(now.value)
  midnight.setHours(24, 0, 0, 0)
  const next = entries.value.reduce((earliest, { row }) => {
    const last = epochMillis(row.last_updated)
    const expiry = last === null ? 0 : last + OFFLINE_AFTER_MS
    return expiry > now.value ? Math.min(earliest, expiry) : earliest
  }, midnight.getTime())
  clock = setTimeout(updateClock, next - now.value)
}
watch(entries, updateClock)

const batch = createBatchBuffer(items => {
  const updates = new Map()
  for (const { site, id, patch } of items) {
    if (!updates.has(site)) updates.set(site, new Map())
    updates.get(site).set(id, patch)
  }
  for (const [site, patches] of updates) {
    if (!site.list) continue
    site.list = { ...site.list, servers: site.list.servers.map(row => {
      const patch = patches.get(String(row.id))
      return patch ? { ...row, ...patch } : row
    }) }
  }
})

function subscribe(site, userInitiated = false) {
  if (!site.list || !alive || document.hidden) return
  const ids = subscribedIds(site.list.servers)
  const allowed = new Set(ids.slice(0, ID_LIMIT))
  let rows = new Map()
  let previous
  connect(site, 'all', ids, updates => {
    const listRows = site.list?.servers
    if (previous !== listRows) {
      previous = listRows
      rows = new Map((listRows ?? []).map(row => [String(row.id), row]))
    }
    for (const update of updates) {
      const id = String(update?.serverId ?? '')
      const row = rows.get(id)
      if (row && allowed.has(id)) batch.add(site, row, update)
    }
  }, userInitiated)
}

function activate(refresh = false) {
  updateClock()
  const readable = sites.filter(canRead)
  if (!readable.length && sites.length === 1 && sites[0].config && !canRead(sites[0])) {
    login(sites[0].base)
  }
  for (const site of readable) void list(site, refresh).then(() => subscribe(site))
}

function suspend() {
  clearTimeout(clock)
  batch.clear()
  disconnect()
}

usePageActivity({ start: activate, resume: () => activate(true), suspend })
onUnmounted(() => { alive = false })
</script>

<template>
  <div class="aqua-page-header">
    <h1>{{ t('overview') }}</h1>
    <div class="aqua-page-controls">
      <button class="aqua-button aqua-sidebar-toggle" type="button" aria-controls="aqua-server-sidebar"
        :aria-expanded="sidebarVisible" @click="$emit('toggle-sidebar')"
      >{{ t(sidebarVisible ? 'hideSidebar' : 'showSidebar') }}</button>
      <input v-model="search" class="aqua-search" type="search" :placeholder="t('search')" :aria-label="t('search')">
    </div>
  </div>
  <OverviewSummary :now="now" />
  <template v-for="site of sites" :key="site.index">
    <p v-if="site.configError || site.listError" class="aqua-state" role="alert">
      {{ site.base }} · {{ t('loadError') }} · {{ t((site.configError || site.listError).message) }}
    </p>
    <p v-else-if="site.config && !canRead(site)" class="aqua-state">
      {{ site.base }} · {{ t('loginRequired') }} <a v-if="themeOptions.show_admin_link" :href="adminUrl(site.base)">{{ t('admin') }}</a>
    </p>
    <LiveStatus v-else :state="states.get(site.index)" :source="sites.length > 1 ? site.base : ''"
      @resume="subscribe(site, true)" @stay-disconnected="stayDisconnected(site, 'all')"
    />
  </template>
  <p v-if="loading && !entries.length" class="aqua-state" role="status">{{ t('loading') }}</p>
  <p v-else-if="!filtered.length" class="aqua-empty">{{ t('empty') }}</p>
  <div v-if="filtered.length" class="aqua-server-grid">
    <ServerCard v-for="{ row, site } of filtered" :key="site.index + ':' + row.id" :row="row" :site="site" :now="now" />
  </div>
</template>
