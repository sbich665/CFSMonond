export const PROBES = [
  ['ct', 'custom_ct', 'custom_ct_name', '电信', 'CT'],
  ['cu', 'custom_cu', 'custom_cu_name', '联通', 'CU'],
  ['cm', 'custom_cm', 'custom_cm_name', '移动', 'CM'],
  ['bd', 'custom_bd', 'custom_bd_name', 'BGP', 'BGP'],
  ...[1, 2, 3, 4].map(number => [
    'node_' + number, 'node_' + number, 'node_' + number + '_name', 'Node ' + number, 'Node ' + number
  ])
]

const WS_FIELDS = [
  'cpu', 'load_avg', 'ram_total', 'ram_used', 'swap_total', 'swap_used', 'disk_total', 'disk_used',
  'disk', 'gpu_info', 'net_in_speed', 'net_out_speed', 'net_rx', 'net_tx', 'net_rx_monthly', 'net_tx_monthly',
  'processes', 'tcp_conn', 'udp_conn', 'cpu_cores', 'cpu_info', 'arch', 'os', 'kernel_version',
  'agent_version', 'boot_time', 'ip_v4', 'ip_v6',
  ...PROBES.flatMap(([key]) => ['ping_' + key, 'loss_' + key])
]

export const OFFLINE_AFTER_MS = 5 * 60_000
const MiB = 1024 ** 2
const GiB = 1024 ** 3
const DAY = 86_400_000
const formatNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const formatCompactNumber = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3, useGrouping: false })
const formatTime = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})

export function epochMillis(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  const timestamp = Number.isFinite(numeric)
    ? numeric * (numeric < 1e12 ? 1000 : 1)
    : Date.parse(value)
  return timestamp > 0 && Number.isFinite(new Date(timestamp).getTime()) ? timestamp : null
}

export function isOnline(server, now = Date.now()) {
  const lastUpdated = epochMillis(server.last_updated)
  return lastUpdated !== null && now - lastUpdated < OFFLINE_AFTER_MS
}

export function number(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function format(value, suffix = '') {
  return value === null || value === undefined || value === ''
    ? '—'
    : (typeof value === 'number' ? formatNumber.format(value) : value) + suffix
}

export function bytes(value, suffix = '', compact = false) {
  const count = number(value)
  if (count === null) return '—'
  const size = Math.abs(count)
  const index = size >= 1024 ? Math.min(4, Math.floor(Math.log(size) / Math.log(1024))) : 0
  const formatter = compact ? formatCompactNumber : formatNumber
  return formatter.format(count / 1024 ** index) + ' ' + ['B', 'KiB', 'MiB', 'GiB', 'TiB'][index] + suffix
}

export function percent(used, total) {
  return used !== null && total > 0 ? 100 * used / total : null
}

export function percentLabel(value) {
  return value === null ? '—' : format(Math.round(value * 10) / 10, '%')
}

export function quotaBytes(value) {
  const quota = Number.parseFloat(value) * GiB
  return Number.isFinite(quota) && quota > 0 ? quota : null
}

export function quotaUsage(server) {
  const rx = number(server.net_rx_monthly)
  const tx = number(server.net_tx_monthly)
  if (server.traffic_calc_type === 'dl') return rx
  if (server.traffic_calc_type === 'ul') return tx
  if (rx === null || tx === null || rx < 0 || tx < 0) return null
  return server.traffic_calc_type === 'max' ? Math.max(rx, tx) : rx + tx
}

export function capacityRows(server) {
  return [
    ['memory', number(server.ram_used), number(server.ram_total), MiB],
    ['disk', number(server.disk_used), number(server.disk_total), MiB],
    ['swap', number(server.swap_used), number(server.swap_total), MiB],
    ['traffic', quotaUsage(server), quotaBytes(server.traffic_limit), 1]
  ].filter(([key, , total]) =>
    !['swap', 'traffic'].includes(key) || total > 0
  )
}

export function capacityLabel(used, total, multiplier) {
  const capacity = total > 0 ? bytes(total * multiplier) : ''
  if (used === null) return capacity
  const current = bytes(used * multiplier)
  if (!capacity) return current
  const [amount, unit] = current.split(' ')
  return (unit && capacity.endsWith(' ' + unit) ? amount : current) + ' / ' + capacity
}

export function probeReading(value, unit, timeout) {
  if (value === null) return timeout
  return Number.isFinite(value) ? format(value, unit) : ''
}

export function probeRows(server, config, timeout, locale, includeTargets = false) {
  return PROBES.flatMap(([id, target, name, zh, en]) => {
    const ping = server['ping_' + id]
    const loss = server['loss_' + id]
    const delay = probeReading(ping, ' ms', timeout)
    const lossRate = probeReading(loss, '%', timeout)
    const address = server[target]
    if (!delay && !lossRate && !(includeTargets && address)) return []
    return [{
      id, target, address, name: config[name] || (locale === 'zh' ? zh : en),
      delay, lossRate, delayTimeout: ping === null, lossTimeout: loss === null
    }]
  })
}

export function expiryInfo(value, now = Date.now()) {
  const date = String(value ?? '').trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (!date) return null
  const expiry = new Date(date + 'T00:00:00Z')
  if (!Number.isFinite(expiry.getTime()) || expiry.toISOString().slice(0, 10) !== date) return null
  const today = new Date(now)
  const localDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return { date, days: Math.round((expiry.getTime() - localDay) / DAY) }
}

export function timeLabel(value, full = false) {
  const timestamp = epochMillis(value)
  if (timestamp === null) return '—'
  const label = formatTime.format(timestamp)
  return full ? label : label.slice(5, 16)
}

export function gpuDevices(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value.filter(device => device && typeof device === 'object') : []
}

export function latestPatch(samples, knownTimestamp = 0) {
  const ordered = (samples ?? []).map(sample => ({
    time: epochMillis(sample?.ts ?? sample?.timestamp),
    data: sample?.data || sample?.payload || sample?.metrics
  })).filter(({ time, data }) => time !== null && time >= knownTimestamp && data && typeof data === 'object')
    .sort((left, right) => left.time - right.time)

  if (!ordered.length) return null
  const patch = {}
  for (const { time, data } of ordered) {
    for (const field of WS_FIELDS) {
      if (Object.hasOwn(data, field) && data[field] !== undefined) patch[field] = data[field]
    }
    patch.last_updated = time
  }
  return patch
}
