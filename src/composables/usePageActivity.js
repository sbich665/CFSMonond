import { onMounted, onUnmounted, shallowReactive } from 'vue'
import { epochMillis, latestPatch } from '../utils/metrics.js'
import { ID_LIMIT, openLive } from '../utils/live.js'
import { useMonitor } from './useMonitor.js'

export function usePageActivity({ start, resume, suspend }) {
  let started = false
  let wasVisible
  function visibility() {
    const visible = !document.hidden
    if (visible === wasVisible) return
    wasVisible = visible
    if (!visible) {
      suspend()
    } else if (started) {
      resume()
    } else {
      started = true
      start()
    }
  }
  onMounted(() => {
    document.addEventListener('visibilitychange', visibility)
    visibility()
  })
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', visibility)
    suspend()
  })
}

export function useConnections() {
  const { paused } = useMonitor()
  const states = shallowReactive(new Map())
  const stops = new Map()

  function disconnect() {
    for (const stop of stops.values()) stop()
    stops.clear()
  }

  function connect(site, scope, ids, consume, userInitiated = false) {
    const key = site.index + ':' + scope
    if (document.hidden || stops.has(key)) return
    if (userInitiated) paused.delete(key)
    if (paused.has(key)) {
      states.set(site.index, paused.get(key))
      return
    }
    if (scope === 'all' && !ids.length) {
      states.set(site.index, 'idle')
      return
    }
    const stop = openLive({
      base: site.base, scope, ids, jwt: site.api.jwt,
      timeoutMinutes: site.config?.frontend_ws_timeout_minutes,
      onBatch: consume,
      onStatus(state) {
        if (state === 'disconnected') stops.delete(key)
        states.set(site.index, state === 'live' && ids.length > ID_LIMIT ? 'limited' : state)
      },
      onTimeout() {
        stops.delete(key)
        paused.set(key, 'paused')
        states.set(site.index, 'paused')
      }
    })
    stops.set(key, stop)
  }

  function stayDisconnected(site, scope) {
    const key = site.index + ':' + scope
    if (paused.get(key) !== 'paused') return
    paused.set(key, 'stopped')
    states.set(site.index, 'stopped')
  }

  return { states, connect, disconnect, stayDisconnected }
}

export function createBatchBuffer(flush) {
  const pending = new Map()
  let timer
  let lastFlushAt = -Infinity

  function add(site, row, update) {
    if (!Array.isArray(update?.samples)) return
    const key = site.index + ':' + row.id
    const current = pending.get(key)
    const patch = latestPatch(update.samples, epochMillis(row.last_updated) ?? 0)
    if (!patch) return
    if (current) {
      current.patch = patch.last_updated >= current.patch.last_updated
        ? { ...current.patch, ...patch }
        : { ...patch, ...current.patch }
    } else {
      pending.set(key, { site, id: String(row.id), patch })
    }
    timer ??= setTimeout(() => {
      timer = undefined
      lastFlushAt = performance.now()
      const batch = [...pending.values()]
      pending.clear()
      if (!document.hidden) flush(batch)
    }, Math.max(0, 1000 - (performance.now() - lastFlushAt)))
  }

  function clear() {
    clearTimeout(timer)
    timer = undefined
    pending.clear()
  }

  return { add, clear }
}
