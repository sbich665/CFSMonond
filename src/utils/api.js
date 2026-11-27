import { clearJwt, fetchJson, getStorage, HttpError, readJwt } from './http.js'

export const HOURS = [0.167, 0.5, 1, 6, 12, 24, 48, 96, 168]
const CREDENTIAL_LIFETIME = 3_600_000

export function createApi(base, {
  fetcher = globalThis.fetch.bind(globalThis),
  storage = getStorage(),
  now = Date.now,
  onChallenge,
  onUnauthorized
} = {}) {
  const credentialKey = 'turnstile_verified:' + base
  let config
  let configRequest
  let verificationRequest
  let credential

  try {
    credential = JSON.parse(storage?.getItem(credentialKey) || 'null')
  } catch {
    credential = null
  }

  function unauthorized() {
    clearJwt(storage)
    if (config) config.authorization = false
    onUnauthorized?.(base)
  }

  async function send(path, { query, ...options } = {}) {
    const url = new URL(path, base)
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value)
    try {
      return await fetchJson(fetcher, url, { jwt: readJwt(storage), ...options })
    } catch (error) {
      if (error.status === 401) unauthorized()
      throw error
    }
  }

  function getConfig() {
    configRequest ??= send('/api/config').then(result => {
      config = result
      return result
    })
    return configRequest
  }

  function setCredential(record) {
    credential = record
    try {
      if (record) storage?.setItem(credentialKey, JSON.stringify(record))
      else storage?.removeItem(credentialKey)
    } catch {
      // The in-memory credential remains usable for the current page.
    }
  }

  async function exchangeToken(token) {
    const result = await send('/api/config', { turnstileToken: token })
    if (result.verified !== true || typeof result.turnstile_verified !== 'string' || !result.turnstile_verified) {
      throw new Error('Turnstile credential was not issued')
    }
    setCredential({ value: result.turnstile_verified, expiresAt: now() + CREDENTIAL_LIFETIME })
  }

  async function ensureVerified(site) {
    if (site.turnstile_enabled !== true) return undefined
    if (typeof credential?.value === 'string' && credential.expiresAt > now()) return credential.value
    if (!site.turnstile_site_key || !onChallenge) throw new Error('Turnstile site key is unavailable')
    verificationRequest ??= Promise.resolve(onChallenge({
      base,
      siteKey: site.turnstile_site_key,
      verify: exchangeToken
    })).finally(() => { verificationRequest = undefined })
    await verificationRequest
    return credential?.value
  }

  async function authorizedRequest(path, options = {}, write = false) {
    const site = await getConfig()
    if ((site.is_public !== true && site.authorization !== true) ||
        (write && (site.authorization !== true || !readJwt(storage)))) {
      unauthorized()
      throw new HttpError(401)
    }
    options.signal?.throwIfAborted()
    const verified = await ensureVerified(site)
    options.signal?.throwIfAborted()
    try {
      return await send(path, { ...options, verified })
    } catch (error) {
      if (error.status !== 403 || site.turnstile_enabled !== true) throw error
      if (credential?.value === verified) setCredential(null)
      options.signal?.throwIfAborted()
      const replacement = await ensureVerified(site)
      options.signal?.throwIfAborted()
      try {
        return await send(path, { ...options, verified: replacement })
      } catch (retryError) {
        if (retryError.status === 403 && credential?.value === replacement) setCredential(null)
        throw retryError
      }
    }
  }

  return {
    base,
    getConfig,
    servers: signal => authorizedRequest('/api/servers', { signal }),
    server: (id, signal) => authorizedRequest('/api/server', { query: { id }, signal }),
    async history(id, hours, signal) {
      if (!HOURS.includes(hours)) throw new Error('Invalid history range')
      return authorizedRequest('/api/history/all', { query: { id, hours }, signal })
    },
    async saveThemeOptions(options) {
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('Theme options must be an object')
      }
      const result = await authorizedRequest('/api/theme_options', {
        method: 'POST',
        body: { theme_options: options }
      }, true)
      if (result.success !== true || !result.theme_options || typeof result.theme_options !== 'object' ||
          Array.isArray(result.theme_options)) {
        throw new Error('Theme options could not be saved')
      }
      return result.theme_options
    },
    jwt: () => readJwt(storage)
  }
}
