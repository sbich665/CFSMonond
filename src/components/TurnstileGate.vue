<script>
let scriptRequest
function loadWidget() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptRequest ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Missing Turnstile API'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error('Turnstile script failed to load'))
    }
    document.head.append(script)
  }).catch(error => {
    scriptRequest = undefined
    throw error
  })
  return scriptRequest
}
</script>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useLabels } from '../utils/i18n.js'

const props = defineProps({ challenge: { type: Object, required: true } })
const { t, locale } = useLabels()
const target = ref(null)
const error = ref('')
let widget
let id
let submitting = false
let disposed = false

async function render() {
  error.value = ''
  if (id !== undefined) {
    widget.reset(id)
    return
  }
  try {
    widget = await loadWidget()
    if (disposed) return
    id = widget.render(target.value, {
      sitekey: props.challenge.siteKey,
      theme: document.documentElement.dataset.theme,
      language: locale.value === 'zh' ? 'zh-cn' : 'en',
      size: 'flexible',
      retry: 'never',
      'error-callback': () => { error.value = 'verifyFailed' },
      'expired-callback': () => { error.value = 'verifyFailed' },
      callback: async token => {
        if (submitting || disposed) return
        submitting = true
        try {
          await props.challenge.complete(token)
        } catch {
          error.value = 'verifyFailed'
        } finally {
          submitting = false
        }
      }
    })
  } catch {
    error.value = 'widgetFailed'
  }
}

onMounted(render)
onUnmounted(() => {
  disposed = true
  if (id !== undefined) widget.remove(id)
})
</script>

<template>
  <section class="aqua-setting-panel" :aria-label="t('verify')">
    <h2>{{ t('verify') }}</h2>
    <div ref="target" class="aqua-turnstile"></div>
    <p v-if="error" role="alert">{{ t(error) }} <button type="button" class="aqua-button" @click="render">{{ t('retry') }}</button></p>
  </section>
</template>
