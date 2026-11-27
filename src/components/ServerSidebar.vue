<script setup>
import { computed } from 'vue'
import { useMonitor } from '../composables/useMonitor.js'
import { useLabels } from '../utils/i18n.js'
import { fieldText } from '../utils/metrics.js'

defineProps({ selection: { type: Object, default: null } })
defineEmits(['select'])

const { entries } = useMonitor()
const { t } = useLabels()
const groups = computed(() => [...new Set(entries.value.map(({ row }) => fieldText(row.server_group)))])
const regions = computed(() => [...new Set(entries.value.map(({ row }) => fieldText(row.region)).filter(Boolean))].sort())
const navigation = computed(() => [
  { field: 'server_group', label: 'groups', names: groups.value.some(Boolean) ? groups.value : [] },
  { field: 'region', label: 'registrationRegion', names: regions.value }
].filter(section => section.names.length))
</script>

<template>
  <nav id="aqua-server-sidebar" class="aqua-sidebar" :aria-label="t('allServers')">
    <div class="aqua-nav-list">
      <button class="aqua-side-button" type="button" :aria-pressed="!selection" @click="$emit('select', null)">{{ t('allServers') }}</button>
    </div>
    <div v-for="section in navigation" :key="section.field" class="aqua-nav-list" role="group" :aria-label="t(section.label)">
      <span class="aqua-nav-label">{{ t(section.label) }}</span>
      <button v-for="name in section.names" :key="name" class="aqua-side-button" type="button"
        :aria-pressed="selection?.field === section.field && selection.name === name" :title="name || t('ungrouped')"
        @click="$emit('select', { field: section.field, name })"
      >{{ name || t('ungrouped') }}</button>
    </div>
  </nav>
</template>
