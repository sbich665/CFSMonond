import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

function origins(value = '') {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean).map(item => {
    const url = new URL(item)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Expected a comma-separated list of HTTP(S) origins')
    }
    return url.origin
  }))]
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const api = origins(env.API_BASE)
  const extraApi = origins(env.CSP_API)
  const staticOrigins = origins(env.CSP_STATIC)
  const title = env.TITLE?.trim()
  const background = env.BACKGROUND_IMAGE?.trim()
  if (background && !['http:', 'https:'].includes(new URL(background).protocol)) {
    throw new Error('BACKGROUND_IMAGE must be an HTTP(S) URL')
  }

  const turnstile = 'https://challenges.cloudflare.com'
  const connect = [...new Set([...api, ...extraApi])].flatMap(origin => [
    origin,
    origin.replace(/^http/, 'ws')
  ])
  const images = [...new Set([...api, ...staticOrigins, ...(background ? [new URL(background).origin] : [])])]
  const csp = [
    "default-src 'self'",
    "script-src 'self' " + turnstile + ' ' + staticOrigins.join(' '),
    "style-src 'self' 'unsafe-inline' " + staticOrigins.join(' '),
    "img-src 'self' data: " + images.join(' '),
    "font-src 'self' " + staticOrigins.join(' '),
    "connect-src 'self' " + [turnstile, ...connect].join(' '),
    'frame-src ' + turnstile,
    "base-uri 'self'",
    "object-src 'none'"
  ].map(value => value.trim()).join('; ')

  return {
    base: './',
    publicDir: false,
    server: { host: '127.0.0.1' },
    plugins: [
      vue(),
      {
        name: 'cfsm-runtime-meta',
        transformIndexHtml() {
          const tags = [
            { tag: 'meta', attrs: { name: 'cfsm-title', content: title || '' } },
            { tag: 'meta', attrs: { name: 'cfsm-background', content: background || '' } }
          ]
          if (mode === 'github-pages') {
            tags.unshift({ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' })
          }
          return [...tags, { tag: 'meta', attrs: { name: 'apiBase', content: api.join(',') } }]
        }
      }
    ],
    build: { sourcemap: false }
  }
})
