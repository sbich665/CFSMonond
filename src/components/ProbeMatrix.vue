<script setup>
import { computed } from 'vue'
import { useLabels } from '../utils/i18n.js'
import ProbeSparkline from './ProbeSparkline.vue'

const props = defineProps({ rows: { type: Array, required: true } })
const { t } = useLabels()
const columns = computed(() => {
  const rows = props.rows
  const middle = Math.ceil(rows.length / 2)
  const right = rows.slice(middle)
  if (right.length < middle) right.push(null)
  const lanes = rows.length <= 3 ? [rows] : [rows.slice(0, middle), right]
  return lanes.map(lane => ({
    rows: lane,
    trend: lane.some(row => row?.trend),
    averages: lane.some(row => row?.delayAveraged) && lane.every(row => !row?.delay || row.delayAveraged || row.delayTimeout)
  }))
})
</script>

<template>
  <div v-if="rows.length" class="aqua-card-probes" :class="{ 'aqua-path-paired': columns.length > 1 }">
    <table v-for="(column, index) of columns" :key="index" class="aqua-path-table" :class="{ 'aqua-path-trends': column.trend }">
      <thead>
        <tr>
          <th scope="col"><span class="aqua-path-reading">{{ t('line') }}</span></th>
          <th v-if="column.trend" scope="col" class="aqua-path-trend"><span class="aqua-path-reading">{{ t('probeTrend') }}</span></th>
          <th scope="col" class="aqua-path-delay"><span class="aqua-path-reading">{{ t(column.averages ? 'avgDelay' : 'delay') }}</span></th>
          <th scope="col"><span class="aqua-path-reading">{{ t('loss') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row of column.rows" :key="row?.id ?? 'spacer'">
          <tr v-if="row" :data-probe="row.id">
            <th scope="row"><span class="aqua-path-reading" :title="row.name">{{ row.name }}</span></th>
            <td v-if="column.trend" class="aqua-path-trend">
              <ProbeSparkline v-if="row.trend" :name="row.name" :trend="row.trend" />
            </td>
            <td :class="{ 'aqua-timeout': row.delayTimeout }">
              <span class="aqua-path-reading" :title="row.delay && t(row.delayAveraged ? 'avgDelay' : 'last_updated') + ' · ' + row.delay">{{ row.delay }}</span>
            </td>
            <td :class="{ 'aqua-timeout': row.lossTimeout }">
              <span class="aqua-path-reading" :title="row.lossRate && t(row.lossAveraged ? 'avgLoss' : 'last_updated') + ' · ' + row.lossRate">{{ row.lossRate }}</span>
            </td>
          </tr>
          <tr v-else class="aqua-path-spacer" aria-hidden="true"><td></td><td v-if="column.trend"></td><td></td><td></td></tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
