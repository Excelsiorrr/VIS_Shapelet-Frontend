<template>
  <div class="action-bar">
    <div class="action-summary">
      <div class="action-title">Linked Actions</div>
      <div class="action-subtitle">
        keep the current sample, pinned shapelet, omega, and span together when drilling down
      </div>
    </div>
    <div class="action-buttons">
      <el-button @click="$emit('open-part-e')" :disabled="!canOpenPartE">Open Part E</el-button>
      <el-button @click="$emit('copy-span')" :disabled="!canCopy">Copy Part E Payload</el-button>
      <el-button @click="$emit('clear-pin')" :disabled="!hasPinned">Clear Pin</el-button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  canCopy: { type: Boolean, default: false },
  canOpenPartE: { type: Boolean, default: false },
  hasPinned: { type: Boolean, default: false },
});

defineEmits(["copy-span", "clear-pin", "open-part-e"]);
</script>

<style scoped lang="scss">
.action-bar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #dde7f2;
  border-radius: 16px;
  background: #ffffff;
}

.action-title {
  color: #1b2a41;
  font-size: 16px;
  font-weight: 800;
}

.action-subtitle {
  margin-top: 4px;
  color: #6e8099;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
