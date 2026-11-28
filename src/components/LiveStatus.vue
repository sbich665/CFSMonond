<script setup>
import { useLabels } from '../utils/i18n.js'

defineProps({ state: String, source: String })
defineEmits(['resume', 'stay-disconnected'])
const { t } = useLabels()
</script>

<template>
  <div v-if="state && !['live', 'idle'].includes(state)" class="aqua-state aqua-live-status"
    :class="{ 'aqua-panel aqua-live-prompt': state === 'paused' }"
  >
    <p role="status">{{ source ? source + ' · ' : '' }}{{ t(state) }}</p>
    <div v-if="['paused', 'stopped', 'disconnected'].includes(state)" class="aqua-page-controls">
      <button v-if="state === 'paused'" class="aqua-button" type="button" @click="$emit('stay-disconnected')">{{ t('stayDisconnected') }}</button>
      <button class="aqua-button" type="button" @click="$emit('resume')">{{ t(state === 'paused' ? 'continue' : 'retryConnection') }}</button>
    </div>
  </div>
</template>
