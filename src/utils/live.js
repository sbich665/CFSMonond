const MAX_RETRIES = 10
const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000
const MAX_LIFETIME_MINUTES = 1440
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
  const minutes = Number(timeoutMinutes)
  const lifetime = Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_LIFETIME_MINUTES ? minutes * 60_000 : 0
  if (scope === 'all' && !ids.length) return () => {}

  function retry() {
    if (stopped) return
    if (attempts >= MAX_RETRIES) {
      onStatus('disconnected')
      return
    }
    const delay = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** attempts)
    attempts += 1
    onStatus('reconnecting')
    retryTimer = setTimeout(connect, delay)
  }

  function stop(reason) {
    stopped = true
    clearTimeout(retryTimer)
    clearTimeout(timeout)
    const current = socket
    socket = undefined
    if (reason) current?.close(1000, reason)
    else current?.close()
  }

  function connect() {
    if (stopped) return
    onStatus('connecting')
    let current
    let openedAt
    try {
      current = new Socket(socketUrl(base, scope, jwt(), pageOrigin))
      socket = current
    } catch {
      retry()
      return
    }

    current.addEventListener('open', () => {
      if (stopped || socket !== current) return
      openedAt = Date.now()
      try {
        if (scope === 'all') current.send(JSON.stringify({ type: 'subscribe', scope: 'all', ids: ids.slice(0, ID_LIMIT) }))
      } catch {
        current.close()
        return
      }
      onStatus('live')
      if (lifetime) {
        timeout = setTimeout(() => {
          if (stopped || socket !== current) return
          stop('connection lifetime exceeded')
          onTimeout()
        }, lifetime)
      }
    })

    current.addEventListener('message', ({ data }) => {
      if (stopped || socket !== current) return
      try {
        const message = JSON.parse(data)
        if (message.type === 'batchUpdate' && Array.isArray(message.updates)) {
          if (message.updates.length) attempts = 0
          onBatch(message.updates)
        }
      } catch {
        // Ignore malformed messages and keep the last valid readings.
      }
    })

    current.addEventListener('close', ({ code }) => {
      if (stopped || socket !== current) return
      socket = undefined
      clearTimeout(timeout)
      // An immediate close after the handshake still counts toward the retry limit.
      if (openedAt !== undefined && Date.now() - openedAt >= MAX_RETRY_MS) attempts = 0
      if (code === 1008) onStatus('disconnected')
      else retry()
    })

    current.addEventListener('error', () => {
      if (!stopped && socket === current) current.close()
    })
  }

  connect()
  return stop
}
