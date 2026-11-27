export class HttpError extends Error {
  constructor(status, payload) {
    super(payload?.error || payload?.message || ('HTTP ' + status))
    this.status = status
  }
}

export function getStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function readJwt(storage) {
  try {
    return storage?.getItem('jwt_token') || ''
  } catch {
    return ''
  }
}

export function clearJwt(storage) {
  try {
    storage?.removeItem('jwt_token')
  } catch {
    // The request still fails as unauthorized if browser storage is unavailable.
  }
}

export async function fetchJson(fetcher, url, { jwt, method = 'GET', body, turnstileToken, verified, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (jwt) headers.Authorization = 'Bearer ' + jwt
  if (turnstileToken) headers['X-Turnstile-Token'] = turnstileToken
  if (verified) headers['X-Turnstile-Verified'] = verified
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetcher(url, {
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new HttpError(response.status, data)
  if (data === null) throw new Error('Invalid JSON from ' + url.pathname)
  return data
}
