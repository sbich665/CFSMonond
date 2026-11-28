import assert from 'node:assert/strict'
import test from 'node:test'
import { createApi } from '../src/utils/api.js'
import { adminUrl, normalizeThemeOptions } from '../src/utils/config.js'
import { openLive, socketUrl, subscribedIds } from '../src/utils/live.js'
import {
  capacityLabel, capacityRows, expiryInfo, latestPatch, overviewStats, probeRows, probeWindows, uptimeDays
} from '../src/utils/metrics.js'
import { osIconUrl } from '../src/utils/osIcon.js'

const base = 'https://test-worker.example'
const instant = Date.parse('2026-11-27T06:30:00Z')

function fixture({ publicSite = true, turnstile = false, authenticated = false } = {}) {
  const recorded = []
  const saved = new Map(authenticated ? [['jwt_token', 'fixture-jwt']] : [])
  const storage = {
    getItem: key => saved.get(key),
    setItem: (key, data) => saved.set(key, data),
    removeItem: key => saved.delete(key)
  }
  let credentials = 'fixture-verified'
  let challenges = 0
  let unauthorized = 0
  const options = {
    storage,
    now: () => instant,
    async onChallenge(challenge) {
      challenges += 1
      await challenge.verify('fixture-token')
    },
    onUnauthorized() { unauthorized += 1 },
    async fetcher(url, request) {
      recorded.push({ url, ...request })
      const { headers } = request
      const auth = headers.Authorization === 'Bearer fixture-jwt'
      if (url.pathname === '/api/config') {
        if (headers['X-Turnstile-Token'] === 'fixture-token') {
          assert(turnstile)
          return Response.json({ verified: true, turnstile_verified: credentials })
        }
        return Response.json({
          is_public: publicSite, authorization: auth, turnstile_enabled: turnstile,
          turnstile_site_key: turnstile ? 'fixture-key' : ''
        })
      }
      if ((!publicSite || request.method === 'POST') && !auth) {
        return Response.json({ error: 'unauthorized' }, { status: 401 })
      }
      if (turnstile && headers['X-Turnstile-Verified'] !== credentials) {
        return Response.json({ error: 'turnstile' }, { status: 403 })
      }
      if (url.pathname === '/api/servers') return Response.json({ servers: [] })
      if (url.pathname === '/api/server') return Response.json({ id: url.searchParams.get('id') })
      if (url.pathname === '/api/history/all') return Response.json([])
      if (url.pathname === '/api/theme_options') {
        return Response.json({ success: true, theme_options: JSON.parse(request.body).theme_options })
      }
      throw new Error('Unexpected route')
    }
  }
  return {
    recorded, storage, newClient: () => createApi(base, options),
    rotateCredential() { credentials = 'fixture-verified-new' },
    challengeCount: () => challenges,
    unauthorizedCount: () => unauthorized
  }
}

test('public sites use one bootstrap request and anonymous headers', async () => {
  const server = fixture()
  const api = server.newClient()
  await Promise.all([api.getConfig(), api.getConfig(), api.servers()])
  await api.server('sg-01')
  await api.history('sg-01', 0.167)
  assert.deepEqual(server.recorded.map(({ url }) => url.pathname), [
    '/api/config', '/api/servers', '/api/server', '/api/history/all'
  ])
  assert.equal(server.recorded.at(-1).url.searchParams.get('hours'), '0.167')
  assert(server.recorded.every(({ headers }) => Object.keys(headers).length === 1))
})

test('public Turnstile exchange is shared by concurrent callers and survives a new page', async () => {
  const server = fixture({ turnstile: true })
  const api = server.newClient()
  await Promise.all([api.servers(), api.server('sg-01'), api.history('sg-01', 0.167)])
  assert.equal(server.challengeCount(), 1)
  assert.equal(server.recorded.filter(({ url }) => url.pathname === '/api/config').length, 2)
  assert.equal(server.recorded.filter(({ headers }) => headers['X-Turnstile-Token']).length, 1)
  assert(server.recorded.slice(2).every(({ headers }) => headers['X-Turnstile-Verified'] === 'fixture-verified'))
  const page = server.newClient()
  await page.servers()
  assert.equal(server.challengeCount(), 1)
  assert.equal(server.recorded.filter(({ url }) => url.pathname === '/api/config').length, 3)
})

test('private sites require login and retain the official admin route', async () => {
  const guest = fixture({ publicSite: false })
  await assert.rejects(guest.newClient().servers(), { status: 401 })
  assert.equal(guest.unauthorizedCount(), 1)
  assert.equal(guest.recorded.length, 1)
  const member = fixture({ publicSite: false, authenticated: true })
  await member.newClient().servers()
  assert.equal(member.recorded.at(-1).headers.Authorization, 'Bearer fixture-jwt')
  assert.equal(adminUrl(base, base), '/admin#/admin')
  assert.equal(socketUrl(base, 'all', 'fixture-jwt', base).searchParams.has('token'), false)
  assert.equal(socketUrl(base, 'sg-01', 'fixture-jwt', 'https://theme.example').searchParams.get('token'), 'fixture-jwt')
})

test('private Turnstile uses both credentials, recovers once after a stale credential, and saves only theme options', async () => {
  const server = fixture({ publicSite: false, authenticated: true, turnstile: true })
  const api = server.newClient()
  await api.servers()
  server.rotateCredential()
  await api.history('sg-01', 0.167)
  assert.equal(normalizeThemeOptions({}).show_server_sidebar, true)
  const draft = normalizeThemeOptions({ speed_order: 'download-first', three_net_panel_count: 5, show_admin_link: false, show_server_sidebar: false, accent: 'blue' })
  assert.equal(draft.show_server_sidebar, false)
  assert.deepEqual(await api.saveThemeOptions(draft), draft)
  assert.equal(server.challengeCount(), 2)
  assert.deepEqual(JSON.parse(server.recorded.at(-1).body), { theme_options: draft })
  assert.equal(server.recorded.at(-1).headers['X-Turnstile-Verified'], 'fixture-verified-new')
  assert.equal(server.recorded.at(-1).headers.Authorization, 'Bearer fixture-jwt')
  await assert.rejects(api.saveThemeOptions([]), TypeError)
  await assert.rejects(api.history('sg-01', 3), /range/)
})

test('an unauthorized response clears the stored token without a reload', async () => {
  const server = fixture({ authenticated: true })
  const api = server.newClient()
  await api.getConfig()
  server.storage.setItem('jwt_token', 'stale')
  await assert.rejects(api.saveThemeOptions({}), { status: 401 })
  assert.equal(server.storage.getItem('jwt_token'), undefined)
  assert.equal(server.unauthorizedCount(), 1)
})

test('incremental batches retain report fields and distinguish unavailable, timeout and zero', () => {
  const patch = latestPatch([
    { ts: instant + 2000, payload: { cpu: 21, ram_used: 100 } },
    { ts: instant, metrics: { cpu: 15, disk: { write_bps: 1 }, loss_ct: 0, ping_ct: null, ping_cu: false } }
  ])
  assert.deepEqual(patch, {
    cpu: 21, disk: { write_bps: 1 }, ping_ct: null, ping_cu: false, loss_ct: 0,
    last_updated: instant + 2000, ram_used: 100
  })
  const rows = probeRows(patch, {}, '超时', 'zh')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].delay, '超时')
  assert.equal(rows[0].lossRate, '0%')
  assert(!capacityRows({ swap_total: 0, swap_used: 0 }).some(row => row[0] === 'swap'))
  assert(capacityRows({ swap_total: 1024, swap_used: 0 }).some(row => row[0] === 'swap'))
  const quota = { traffic_limit: '1', traffic_calc_type: 'total', net_rx_monthly: 0 }
  assert.deepEqual(capacityRows(quota).at(-1), ['traffic', null, 1024 ** 3, 1])
  assert.deepEqual(capacityRows({ ...quota, net_tx_monthly: 0 }).at(-1), ['traffic', 0, 1024 ** 3, 1])
  assert.equal(capacityLabel(null, null, 1), '')
  assert.equal(capacityLabel(null, 1024, 1), '1 KiB')
  assert.equal(capacityLabel(0, 1024, 1), '0 B / 1 KiB')
  assert.deepEqual(expiryInfo('2027-01-12', new Date(2026, 10, 27, 12)), { date: '2027-01-12', days: 46 })
  assert.equal(expiryInfo('2027-02-30'), null)
})

test('overview counts online stacks separately and sums reported rates and visible traffic', () => {
  const visible = { list: { sysConfig: { show_tf: true } } }
  const hidden = { list: { sysConfig: { show_tf: false } } }
  const entries = [
    { site: visible, row: { last_updated: instant, ip_v4: '1', ip_v6: '1', net_in_speed: '256', net_out_speed: 0, net_rx: 90, net_tx: 10, net_rx_monthly: 120 } },
    { site: visible, row: { last_updated: instant, ip_v4: '1', ip_v6: '0', net_in_speed: null, net_out_speed: 12, net_rx: 0, net_tx: -1, net_tx_monthly: 0 } },
    { site: hidden, row: { last_updated: instant, ip_v4: '0', ip_v6: '1', net_in_speed: 50, net_out_speed: -2, net_rx: 1000, net_tx_monthly: 1000 } },
    { site: visible, row: { last_updated: instant - 300_000, ip_v4: '1', net_in_speed: 999, net_out_speed: 999, net_rx: 40, net_tx_monthly: 30 } }
  ]
  assert.deepEqual(overviewStats(entries, instant), {
    total: 4, online: 3, ipv4Only: 1, ipv6Only: 1, dualStack: 1,
    download: 306, upload: 12, bootTraffic: { download: 130, upload: 10 }, periodTraffic: { download: 120, upload: 30 }
  })
  const missing = overviewStats([{ site: visible, row: { last_updated: instant } }], instant)
  assert.equal(missing.download, null)
  assert.deepEqual(missing.bootTraffic, { download: null, upload: null })
  assert.deepEqual(missing.periodTraffic, { download: null, upload: null })
  assert.equal(overviewStats(entries, instant + 300_000).download, 0)
})

test('overview probe windows keep real timestamps, gaps and zero readings', () => {
  const later = instant + 420_000
  const latest = instant + 720_000
  const windows = probeWindows([
    { ts: latest, ct: 60, cu: 26, node_1: -1 },
    { ts: instant / 1000, ct: 0, cu: 25 },
    { ts: later, ct: null },
    { ts: 'unreported', ct: 9999 }
  ], [
    { ts: instant, ct: 0 }, { ts: later, ct: 100, bd: 0 },
    { ts: latest, ct: 20, cu: false, bd: 0, node_1: 101 }
  ], { hours: 2, points: 20 })
  const rows = probeRows({ ping_ct: 8, loss_ct: 0, ping_cu: 30, ping_cm: 0, loss_cm: 0,
    ping_bd: 12, loss_node_1: false }, {}, 'Timeout', 'en', false, windows)
  assert.deepEqual(rows.map(row => row.id), ['ct', 'cm', 'bd'])
  const [ct, cm, bd] = rows
  assert.equal(ct.delay, '30 ms')
  assert.equal(ct.lossRate, '40%')
  assert.equal(ct.delayAveraged, true)
  assert.deepEqual(ct.trend.delay.points, [{ time: instant, value: 0 }, { time: later, value: null }, { time: latest, value: 60 }])
  assert.equal(ct.trend.maxGap, 720_000)
  assert.deepEqual([cm.delay, cm.lossRate, cm.trend], ['0 ms', '0%', null])
  assert.deepEqual([bd.delayAveraged, bd.lossAveraged, bd.lossRate], [false, true, '0%'])
  assert.equal(probeWindows([], [], {}), null)
  assert.equal(probeRows({ ping_cu: false, loss_cu: false }, {}, 'Timeout', 'en', false, windows).length, 2)
  assert.equal(probeRows({ ping_ct: 8, loss_ct: 0 }, {}, 'Timeout', 'en')[0].trend, null)
})

test('uptime uses completed 24-hour periods and requires a valid interval', () => {
  const day = 86_400_000
  assert.equal(uptimeDays(instant, instant + day - 1), 0)
  assert.equal(uptimeDays(instant, instant + day), 1)
  assert.equal(uptimeDays(instant, instant + 11 * day + 5000), 11)
  assert.equal(uptimeDays(instant, instant - 1000), null)
  assert.equal(uptimeDays(instant, null), null)
  assert.equal(uptimeDays(null, instant), null)
})

test('OS logos use the reporting Worker and published asset names', () => {
  assert.equal(osIconUrl('openSUSE Leap 15.6', base), base + '/os-icons/os-openSUSE.svg')
  assert.equal(osIconUrl('Kali GNU/Linux', base), base + '/os-icons/os-kail.svg')
  assert.equal(osIconUrl('Proxmox VE (Debian GNU/Linux)', base), base + '/os-icons/os-proxmox.ico')
  assert.equal(osIconUrl('  ', base), '')
})

test('WS subscriptions use the IDs of one origin, and detail omits the all subscription command', () => {
  class Socket extends EventTarget {
    static connections = []
    constructor(url) {
      super()
      this.url = url
      this.sent = []
      Socket.connections.push(this)
    }
    send(data) { this.sent.push(JSON.parse(data)) }
    close() { this.closed = true }
  }
  const init = { base, pageOrigin: base, Socket, jwt: () => '', timeoutMinutes: 0, onBatch() {}, onStatus() {}, onTimeout() {} }
  const stopList = openLive({ ...init, scope: 'all', ids: subscribedIds([{ id: 'sg-01' }, { id: 'bad/id' }, { id: 'sg-01' }]) })
  const stopDetail = openLive({ ...init, scope: 'sg-01' })
  const [list, detail] = Socket.connections
  list.dispatchEvent(new Event('open'))
  detail.dispatchEvent(new Event('open'))
  assert.deepEqual(list.sent, [{ type: 'subscribe', scope: 'all', ids: ['sg-01'] }])
  assert.equal(detail.url.searchParams.get('subscribe'), 'sg-01')
  assert.equal(detail.sent.length, 0)
  stopList()
  stopDetail()
  assert(list.closed && detail.closed)
})

test('WS timeout pauses explicitly and reconnect delay doubles on unexpected closes', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const connections = []
  class Socket extends EventTarget {
    constructor() { super(); connections.push(this) }
    close(...args) { this.closed = true; this.closeArgs = args; this.dispatchEvent(new Event('close')) }
  }
  let prompted = 0
  const common = {
    base, pageOrigin: base, Socket, scope: 'sg-01', jwt: () => '',
    onBatch() {}, onStatus() {}, onTimeout() { prompted += 1 }
  }
  const stop = openLive({ ...common, timeoutMinutes: 1 })
  connections[0].dispatchEvent(new Event('open'))
  t.mock.timers.tick(60_000)
  assert.equal(prompted, 1)
  assert.equal(connections[0].closed, true)
  assert.deepEqual(connections[0].closeArgs, [1000, 'connection lifetime exceeded'])
  t.mock.timers.tick(60_000)
  assert.equal(connections.length, 1)
  stop()

  const retry = openLive({ ...common, timeoutMinutes: 0 })
  connections.at(-1).dispatchEvent(new Event('close'))
  t.mock.timers.tick(999)
  assert.equal(connections.length, 2)
  t.mock.timers.tick(1)
  assert.equal(connections.length, 3)
  connections.at(-1).dispatchEvent(new Event('close'))
  t.mock.timers.tick(1999)
  assert.equal(connections.length, 3)
  t.mock.timers.tick(1)
  assert.equal(connections.length, 4)
  retry()
})

test('WS backoff caps at 30 seconds and ten retries even after short-lived handshakes', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const connections = []
  const states = []
  class Socket extends EventTarget {
    constructor() { super(); connections.push(this) }
    close() { this.dispatchEvent(new Event('close')) }
  }
  const options = {
    base, pageOrigin: base, Socket, scope: 'sg-01', jwt: () => '', timeoutMinutes: 0,
    onBatch() {}, onStatus(state) { states.push(state) }, onTimeout() { assert.fail('Unexpected lifetime limit') }
  }
  const stop = openLive(options)
  const delays = [1000, 2000, 4000, 8000, 16000, 30_000, 30_000, 30_000, 30_000, 30_000]
  for (const [index, delay] of delays.entries()) {
    connections.at(-1).dispatchEvent(new Event('open'))
    connections.at(-1).dispatchEvent(new Event('error'))
    t.mock.timers.tick(delay - 1)
    assert.equal(connections.length, index + 1)
    t.mock.timers.tick(1)
    assert.equal(connections.length, index + 2)
  }
  connections.at(-1).dispatchEvent(new Event('close'))
  assert.equal(states.at(-1), 'disconnected')
  t.mock.timers.tick(60_000)
  assert.equal(connections.length, 11)
  stop()

  const cancelPending = openLive(options)
  connections.at(-1).dispatchEvent(new Event('close'))
  cancelPending()
  t.mock.timers.tick(30_000)
  assert.equal(connections.length, 12)
})
