<script setup>
defineProps({
  title: { type: String, required: true },
  rows: { type: Array, required: true }
})
</script>

<template>
  <section v-if="rows.length" class="aqua-panel aqua-section">
    <h2>{{ title }}</h2>
    <dl class="aqua-fields">
      <div v-for="[key, label, value] of rows" :key="key" :data-field="key">
        <dt>{{ label }}</dt><dd>{{ value }}</dd>
      </div>
    </dl>
  </section>
</template>
