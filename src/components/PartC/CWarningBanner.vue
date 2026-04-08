<template>
  <div v-if="warnings.length" class="warning-banner">
    <div class="warning-title">Warnings</div>
    <ul class="warning-list">
      <li v-for="warning in warnings" :key="`${warning.code}-${warning.message}`">
        <span class="warning-code">{{ warning.code }}</span>
        <span class="warning-message">{{ warning.message }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  warnings: {
    type: Array,
    default: () => [],
  },
});
</script>

<style scoped lang="scss">
.warning-banner {
  padding: 10px 12px;
  border: 1px solid #f1d8a6;
  border-radius: 12px;
  background: #fff8e7;
}

.warning-title {
  margin-bottom: 6px;
  color: #8a5a00;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.warning-list {
  margin: 0;
  padding-left: 18px;
  color: #7a6232;
  font-size: 12px;
  line-height: 1.55;
}

.warning-code {
  margin-right: 6px;
  color: #ad6d00;
  font-weight: 700;
}
</style>
