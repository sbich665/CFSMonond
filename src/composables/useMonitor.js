import { computed, inject, reactive, shallowReactive, shallowRef } from 'vue'
import { createApi } from '../utils/api.js'
import { adminUrl, normalizeThemeOptions } from '../utils/config.js'

export const MonitorKey = Symbol('monitor')

export function createMonitor(runtime) {
  const challenges = shallowRef([])
  const paused = new Map()
  const themeOptions = shallowRef(normalizeThemeOptions())
  let redirected = false

  function login(base) {
    if (redirected) return
    redirected = true
    window.location.assign(adminUrl(base))
  }

  function onChallenge(challenge) {
    return new Promise(resolve => {
      const pending = {
        ...challenge,
        async complete(token) {
          await challenge.verify(token)
          challenges.value = challenges.value.filter(item => item !== pending)
          resolve()
        }
      }
      challenges.value = [...challenges.value, pending]
    })
  }

  const sites = runtime.bases.map((base, index) => {
    const site = shallowReactive({
      base, index, config: null, configError: null, list: null, listError: null,
      listInFlight: null, initialList: null
    })
    site.api = createApi(base, {
      onChallenge,
      onUnauthorized() {
        if (site.config) site.config.authorization = false
        login(base)
      }
    })
    return site
  })
  const entries = computed(() => sites.flatMap(site => (site.list?.servers ?? []).map(row => ({ site, row }))))

  async function bootstrap() {
    await Promise.all(sites.map(async site => {
      try {
        const config = await site.api.getConfig()
        if (typeof config?.is_public !== 'boolean') throw new Error('Invalid site configuration')
        site.config = reactive(config)
      } catch (error) {
        site.configError = error
      }
    }))
    themeOptions.value = normalizeThemeOptions(sites[0]?.config?.theme_options)
  }

  function list(site, refresh = false) {
    if (site.listInFlight) return site.listInFlight
    if (!refresh && site.initialList) return site.initialList

    const request = site.api.servers().then(data => {
      if (!Array.isArray(data.servers)) throw new Error('Invalid server list')
      site.list = data
      site.listError = null
    }).catch(error => {
      site.listError = error
    }).finally(() => {
      site.listInFlight = null
    })
    site.listInFlight = request
    site.initialList ??= request
    return request
  }

  return { runtime, sites, entries, challenges, paused, themeOptions, bootstrap, login, list }
}

export function useMonitor() {
  return inject(MonitorKey)
}

export function canRead(site) {
  return site?.config?.is_public === true || site?.config?.authorization === true
}
