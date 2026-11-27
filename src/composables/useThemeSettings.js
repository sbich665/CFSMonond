import { ref } from 'vue'
import { normalizeThemeOptions } from '../utils/config.js'
import { useMonitor } from './useMonitor.js'

export function useThemeSettings() {
  const { sites, themeOptions } = useMonitor()
  const status = ref('')
  let draft
  let timer
  let saving = false
  let revision = 0
  let due = false

  async function save() {
    if (saving || !due || !draft) return
    const primary = sites[0]
    if (primary?.config?.authorization !== true) return
    saving = true
    due = false
    const current = revision
    const values = draft
    status.value = 'saving'
    try {
      const persisted = await primary.api.saveThemeOptions(values)
      primary.config.theme_options = persisted
      if (current === revision) {
        themeOptions.value = normalizeThemeOptions(persisted)
        draft = null
        status.value = 'saved'
      }
    } catch {
      if (current === revision) {
        themeOptions.value = normalizeThemeOptions(primary.config.theme_options)
        status.value = 'saveFailed'
      }
    } finally {
      saving = false
      if (due) void save()
    }
  }

  function update(patch) {
    if (sites[0]?.config?.authorization !== true) return
    draft = normalizeThemeOptions({ ...(draft ?? themeOptions.value), ...patch })
    themeOptions.value = draft
    revision += 1
    status.value = 'waiting'
    due = false
    clearTimeout(timer)
    timer = setTimeout(() => {
      due = true
      void save()
    }, 350)
  }

  function retry() {
    if (!draft || sites[0]?.config?.authorization !== true) return
    themeOptions.value = draft
    due = true
    void save()
  }

  return { status, update, retry }
}
