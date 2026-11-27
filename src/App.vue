<script setup>
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import ThemeSettings from './components/ThemeSettings.vue'
import TurnstileGate from './components/TurnstileGate.vue'
import { useMonitor } from './composables/useMonitor.js'
import { useThemeSettings } from './composables/useThemeSettings.js'
import { adminUrl } from './utils/config.js'
import { useLabels } from './utils/i18n.js'

const { runtime, sites, challenges, themeOptions, bootstrap } = useMonitor()
const { t, locale } = useLabels()
const settings = useThemeSettings()
const ready = ref(false)
const settingsOpen = ref(false)
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
const primary = computed(() => sites[0])
const siteName = computed(() => primary.value.config?.site_title || runtime.title || new URL(primary.value.base).hostname)
const authorized = computed(() => primary.value.config?.authorization === true)
const challenge = computed(() => challenges.value[0])

function changeSystem({ matches }) {
  systemDark.value = matches
}

watchEffect(() => {
  document.title = siteName.value
  document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
  const choice = primary.value.config?.preferred_theme
  document.documentElement.dataset.theme = choice === 'dark' || (choice !== 'light' && systemDark.value) ? 'dark' : 'light'
  if (!authorized.value) settingsOpen.value = false
})

onMounted(async () => {
  media.addEventListener('change', changeSystem)
  if (runtime.background) {
    try {
      const background = new URL(runtime.background, window.location.href)
      if (['http:', 'https:'].includes(background.protocol)) {
        document.body.style.backgroundImage = 'url(' + JSON.stringify(background.href) + ')'
      }
    } catch {
      // Invalid build configuration is rejected by Vite before publishing.
    }
  }
  await bootstrap()
  ready.value = true
})
onUnmounted(() => media.removeEventListener('change', changeSystem))
</script>

<template>
  <div id="cfs-aqua">
    <div class="aqua-window">
      <header class="aqua-toolbar">
        <div class="aqua-brand">
          <span class="aqua-rack" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>{{ siteName }}</span>
        </div>
        <button
          v-if="authorized" class="aqua-button" type="button"
          :aria-expanded="settingsOpen" aria-controls="aqua-settings"
          @click="settingsOpen = !settingsOpen"
        >{{ t('settings') }}</button>
        <a v-if="themeOptions.show_admin_link" class="aqua-button" :href="adminUrl(primary.base)">{{ t('admin') }}</a>
      </header>
      <ThemeSettings v-if="authorized" v-show="settingsOpen" :settings="settings" />
      <TurnstileGate v-if="challenge" :key="challenge.base" :challenge="challenge" />
      <p v-if="!ready" class="aqua-state" role="status">{{ t('opening') }}</p>
      <RouterView v-else v-slot="{ Component, route }">
        <component :is="Component" v-if="Component" :key="route.fullPath" />
        <p v-else class="aqua-state" role="alert">{{ t('loadError') }} · {{ route.path }}</p>
      </RouterView>
      <footer class="aqua-footer">
        <a
          href="https://github.com/huilang-me/CF-Server-Monitor/" target="_blank" rel="noopener noreferrer"
          :title="primary.config?.version || undefined"
        >Powered by CF-Server-Monitor</a>
      </footer>
    </div>
  </div>
</template>
