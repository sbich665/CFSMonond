const MAX_RETRIES = 6
export const ID_LIMIT = 500
const ID = /^[A-Za-z0-9._:-]{1,64}$/

export function subscribedIds(servers) {
  return [...new Set(servers.map(({ id }) => String(id ?? '')).filter(value => ID.test(value)))]
}

export function socketUrl(base, scope, jwt, pageOrigin) {
  const url = new URL('/api/ws', base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('subscribe', scope)
  if (base !== pageOrigin && jwt && url.protocol === 'wss:') url.searchParams.set('token', jwt)
  return url
}

export function openLive({
  base, scope, ids = [], jwt, timeoutMinutes, onBatch, onStatus, onTimeout,
  pageOrigin = window.location.origin, Socket = WebSocket
}) {
  let socket
  let retryTimer
  let timeout
  let stopped = false
  let attempts = 0
  if (scope === 'all' && !ids.length) return () => {}

  function retry() {
    if (stopped) return
    if (attempts >= MAX_RETRIES) {
      onStatus('disconnected')
      return
    }
    const delay = Math.min(30_000, 1000 * 2 ** attempts)
    attempts += 1
    onStatus('reconnecting')
    retryTimer = setTimeout(connect, delay)
  }

  function stop() {
    stopped = true
    clearTimeout(retryTimer)
    clearTimeout(timeout)
    socket?.close()
  }

  function connect() {
    if (stopped) return
    onStatus('connecting')
    let current
    try {
      current = new Socket(socketUrl(base, scope, jwt(), pageOrigin))
      socket = current
    } catch {
      retry()
      return
    }

    current.addEventListener('open', () => {
      if (stopped || socket !== current) return
      if (scope === 'all') {
        current.send(JSON.stringify({ type: 'subscribe', scope: 'all', ids: ids.slice(0, ID_LIMIT) }))
      }
      onStatus('live')
      if (Number.isFinite(timeoutMinutes) && timeoutMinutes > 0) {
        timeout = setTimeout(() => {
          stop()
          onTimeout()
        }, Math.min(timeoutMinutes, 1440) * 60_000)
      }
    })

    current.addEventListener('message', ({ data }) => {
      if (stopped || socket !== current) return
      try {
        const message = JSON.parse(data)
        if (message.type === 'batchUpdate' && Array.isArray(message.updates)) {
          attempts = 0
          onBatch(message.updates)
        }
      } catch {
        // Ignore malformed messages and keep the last valid readings.
      }
    })

    current.addEventListener('close', ({ code }) => {
      if (stopped || socket !== current) return
      clearTimeout(timeout)
      if (code === 1008) onStatus('disconnected')
      else retry()
    })
  }

  connect()
  return stop
}
