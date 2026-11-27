import { createApp } from 'vue'
import App from './App.vue'
import { createMonitor, MonitorKey } from './composables/useMonitor.js'
import { router } from './router/index.js'
import { readRuntime } from './utils/config.js'
import './theme.css'

try {
  const runtime = readRuntime()
  createApp(App).provide(MonitorKey, createMonitor(runtime)).use(router).mount('#app')
} catch (error) {
  const container = document.getElementById('app')
  container.setAttribute('role', 'alert')
  container.textContent = error.message
}
