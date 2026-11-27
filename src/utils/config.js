function meta(name) {
  return document.querySelector('meta[name="' + name + '"]')?.content.trim() || ''
}

export function apiOrigin(value) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid API origin')
  }
  return url.origin
}

export function readRuntime() {
  const values = meta('apiBase').split(',').map(value => value.trim()).filter(Boolean)
  return {
    bases: [...new Set((values.length ? values : [window.location.origin]).map(apiOrigin))],
    title: meta('cfsm-title') || document.title,
    background: meta('cfsm-background')
  }
}

export function adminUrl(base, pageOrigin = window.location.origin) {
  return (base === pageOrigin ? '' : base) + '/admin#/admin'
}

export function normalizeThemeOptions(options) {
  const raw = options && typeof options === 'object' && !Array.isArray(options) ? options : {}
  const count = Number(raw.three_net_panel_count ?? 3)
  return {
    ...raw,
    speed_order: raw.speed_order === 'download-first' ? 'download-first' : 'upload-first',
    three_net_panel_count: Number.isInteger(count) && count >= 0 && count <= 8 ? count : 3,
    show_admin_link: raw.show_admin_link !== false
  }
}
