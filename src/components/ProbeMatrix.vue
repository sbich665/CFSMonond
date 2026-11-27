<script setup>
import { computed } from 'vue'
import { useLabels } from '../utils/i18n.js'

const props = defineProps({ rows: { type: Array, required: true } })
const { t } = useLabels()
const columns = computed(() => {
  const rows = props.rows
  if (rows.length <= 3) return [rows]
  const middle = Math.ceil(rows.length / 2)
  const right = rows.slice(middle)
  if (right.length < middle) right.push(null)
  return [rows.slice(0, middle), right]
})
</script>

<template>
  <div v-if="rows.length" class="aqua-card-probes" :class="{ 'aqua-path-paired': columns.length > 1 }">
    <table v-for="(column, index) of columns" :key="index" class="aqua-path-table">
      <thead>
        <tr>
          <th scope="col"><span class="aqua-path-reading">{{ t('line') }}</span></th>
          <th scope="col"><span class="aqua-path-reading">{{ t('delay') }}</span></th>
          <th scope="col"><span class="aqua-path-reading">{{ t('loss') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row of column" :key="row?.id ?? 'spacer'">
          <tr v-if="row" :data-probe="row.id">
            <th scope="row"><span class="aqua-path-reading" :title="row.name">{{ row.name }}</span></th>
            <td :class="{ 'aqua-timeout': row.delayTimeout }"><span class="aqua-path-reading" :title="row.delay">{{ row.delay }}</span></td>
            <td :class="{ 'aqua-timeout': row.lossTimeout }"><span class="aqua-path-reading" :title="row.lossRate">{{ row.lossRate }}</span></td>
          </tr>
          <tr v-else class="aqua-path-spacer" aria-hidden="true"><td></td><td></td><td></td></tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
