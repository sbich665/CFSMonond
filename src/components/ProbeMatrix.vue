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
  return lanes.map(lane => {
    const delayTrend = lane.some(row => row?.delayAveraged)
    return {
      rows: lane,
      delayTrend,
      lossTrend: lane.some(row => row?.lossAveraged),
      averages: delayTrend && lane.every(row => !row?.delay || row.delayAveraged || row.delayTimeout)
    }
  })
})
</script>

<template>
  <div v-if="rows.length" class="aqua-card-probes" :class="{ 'aqua-path-paired': columns.length > 1 }">
    <table v-for="(column, index) of columns" :key="index" class="aqua-path-table"
      :class="{ 'aqua-path-trends': column.delayTrend || column.lossTrend }"
    >
      <thead>
        <tr>
          <th scope="col"><span class="aqua-path-reading">{{ t('line') }}</span></th>
          <th scope="col" class="aqua-path-delay" :class="{ 'is-average': column.averages }">
            <span class="aqua-path-reading">{{ t(column.averages ? 'avgDelay' : 'delay') }}</span>
          </th>
          <th scope="col"><span class="aqua-path-reading">{{ t('loss') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row of column.rows" :key="row?.id ?? 'spacer'">
          <tr v-if="row" :data-probe="row.id">
            <th scope="row"><span class="aqua-path-reading" :title="row.name">{{ row.name }}</span></th>
            <td class="aqua-path-delay" :class="{ 'aqua-timeout': row.delayTimeout }">
              <div class="aqua-path-value" :class="{ 'is-charted': column.delayTrend }">
                <ProbeSparkline v-if="row.delayAveraged" kind="delay" :name="row.name" :trend="row.trend" />
                <span class="aqua-path-reading" :title="row.delay && t(row.delayAveraged ? 'avgDelay' : 'last_updated') + ' · ' + row.delay">{{ row.delay }}</span>
              </div>
            </td>
            <td class="aqua-path-loss" :class="{ 'aqua-timeout': row.lossTimeout }">
              <div class="aqua-path-value" :class="{ 'is-charted': column.lossTrend }">
                <ProbeSparkline v-if="row.lossAveraged" kind="loss" :name="row.name" :trend="row.trend" />
                <span class="aqua-path-reading" :title="row.lossRate && t(row.lossAveraged ? 'avgLoss' : 'last_updated') + ' · ' + row.lossRate">{{ row.lossRate }}</span>
              </div>
            </td>
          </tr>
          <tr v-else class="aqua-path-spacer" aria-hidden="true"><td></td><td></td><td></td></tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
