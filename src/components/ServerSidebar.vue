<script setup>
import { computed } from 'vue'
import { useMonitor } from '../composables/useMonitor.js'
import { useLabels } from '../utils/i18n.js'

defineEmits(['select'])

const { serverGroups, serverRegions, overviewFilters } = useMonitor()
const { t } = useLabels()
const navigation = computed(() => [
  { field: 'server_group', label: 'groups', names: serverGroups.value.some(Boolean) ? serverGroups.value : [] },
  { field: 'region', label: 'registrationRegion', names: serverRegions.value }
].filter(section => section.names.length))
</script>

<template>
  <nav id="aqua-server-sidebar" class="aqua-sidebar" :aria-label="t('allServers')">
    <div class="aqua-nav-list">
      <button class="aqua-side-button" type="button" :aria-pressed="overviewFilters.server_group === null && overviewFilters.region === null"
        @click="$emit('select', null)"
      >{{ t('allServers') }}</button>
    </div>
    <div v-for="section in navigation" :key="section.field" class="aqua-nav-list" role="group" :aria-label="t(section.label)">
      <span class="aqua-nav-label">{{ t(section.label) }}</span>
      <button v-for="name in section.names" :key="name" class="aqua-side-button" type="button"
        :aria-pressed="overviewFilters[section.field] === name" :title="name || t('ungrouped')"
        @click="$emit('select', { field: section.field, name })"
      >{{ name || t('ungrouped') }}</button>
    </div>
  </nav>
</template>
