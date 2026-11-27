<script setup>
import { useMonitor } from '../composables/useMonitor.js'
import { useLabels } from '../utils/i18n.js'

defineProps({ settings: { type: Object, required: true } })
const { themeOptions } = useMonitor()
const { t } = useLabels()
</script>

<template>
  <section id="aqua-settings" class="aqua-setting-panel" aria-labelledby="aqua-settings-title">
    <div class="aqua-panel-heading">
      <h2 id="aqua-settings-title">{{ t('settings') }}</h2>
      <span class="aqua-setting-status" role="status">{{ t(settings.status.value || 'autoSave') }}</span>
    </div>
    <div class="aqua-setting-fields">
      <label>
        <span>{{ t('speedOrder') }}</span>
        <select class="aqua-button" :value="themeOptions.speed_order" @change="settings.update({ speed_order: $event.target.value })">
          <option value="upload-first">{{ t('uploadFirst') }}</option>
          <option value="download-first">{{ t('downloadFirst') }}</option>
        </select>
      </label>
      <label>
        <span>{{ t('lineCount') }}</span>
        <select class="aqua-button" :value="themeOptions.three_net_panel_count" @change="settings.update({ three_net_panel_count: Number($event.target.value) })">
          <option :value="0">{{ t('hideLines') }}</option>
          <option v-for="count in 8" :key="count" :value="count">{{ count }}</option>
        </select>
      </label>
      <label class="aqua-setting-check">
        <input type="checkbox" :checked="themeOptions.show_admin_link" @change="settings.update({ show_admin_link: $event.target.checked })">
        <span>{{ t('adminLink') }}</span>
      </label>
      <label class="aqua-setting-check">
        <input type="checkbox" :checked="themeOptions.show_server_sidebar" @change="settings.update({ show_server_sidebar: $event.target.checked })">
        <span>{{ t('serverSidebar') }}</span>
      </label>
      <button v-if="settings.status.value === 'saveFailed'" class="aqua-button" type="button" @click="settings.retry">{{ t('retry') }}</button>
    </div>
  </section>
</template>
