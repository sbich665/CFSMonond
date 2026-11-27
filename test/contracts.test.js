import assert from 'node:assert/strict'
import test from 'node:test'
import { createApi } from '../src/utils/api.js'
import { adminUrl, normalizeThemeOptions } from '../src/utils/config.js'
import { openLive, socketUrl, subscribedIds } from '../src/utils/live.js'
import { capacityRows, expiryInfo, latestPatch, probeRows } from '../src/utils/metrics.js'

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
  const draft = normalizeThemeOptions({ speed_order: 'download-first', three_net_panel_count: 5, show_admin_link: false, accent: 'blue' })
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
  assert.deepEqual(expiryInfo('2027-01-12', new Date(2026, 10, 27, 12)), { date: '2027-01-12', days: 46 })
  assert.equal(expiryInfo('2027-02-30'), null)
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
    close() { this.closed = true; this.dispatchEvent(new Event('close')) }
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
