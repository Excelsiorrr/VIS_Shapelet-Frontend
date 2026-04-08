<template>
  <div class="context-bar">
    <div class="context-main">
      <div class="page-title">Part C · Match & Locate</div>
      <div class="page-subtitle">
        inspect a single sample's shapelet-match tensor and aligned evidence window
      </div>
    </div>

    <div class="context-chips">
      <div class="chip">
        <span class="chip-label">dataset</span>
        <span class="chip-value">{{ datasetName || "-" }}</span>
      </div>
      <div class="chip">
        <span class="chip-label">sample</span>
        <span class="chip-value">{{ sampleId || "-" }}</span>
      </div>
      <div class="chip">
        <span class="chip-label">scope</span>
        <span class="chip-value">{{ scope || "-" }}</span>
      </div>
      <div class="chip">
        <span class="chip-label">omega</span>
        <span class="chip-value">{{ omegaText }}</span>
      </div>
      <div class="chip">
        <span class="chip-label">source</span>
        <span class="chip-value">{{ sourcePanel || "-" }}</span>
      </div>
      <div class="chip chip-accent">
        <span class="chip-label">pinned</span>
        <span class="chip-value">{{ pinnedShapeletId || "-" }}</span>
      </div>
      <div class="chip" v-if="predClass !== null && predClass !== undefined">
        <span class="chip-label">pred</span>
        <span class="chip-value">{{ predClass }}</span>
      </div>
      <div class="chip" v-if="margin !== null && margin !== undefined">
        <span class="chip-label">margin</span>
        <span class="chip-value">{{ marginText }}</span>
      </div>
      <div class="chip" v-if="peakT !== null && peakT !== undefined">
        <span class="chip-label">peak_t</span>
        <span class="chip-value">{{ peakT }}</span>
      </div>
      <div class="chip" v-if="triggered !== null && triggered !== undefined">
        <span class="chip-label">triggered</span>
        <span class="chip-value">{{ triggered ? "yes" : "no" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  datasetName: { type: String, default: "" },
  sampleId: { type: String, default: "" },
  scope: { type: String, default: "" },
  omega: { type: Number, default: null },
  sourcePanel: { type: String, default: "" },
  pinnedShapeletId: { type: String, default: "" },
  predClass: { type: Number, default: null },
  margin: { type: Number, default: null },
  peakT: { type: Number, default: null },
  triggered: { type: Boolean, default: null },
});

const omegaText = computed(() => {
  if (typeof props.omega !== "number" || Number.isNaN(props.omega)) {
    return "-";
  }
  return props.omega.toFixed(3);
});

const marginText = computed(() => {
  if (typeof props.margin !== "number" || Number.isNaN(props.margin)) {
    return "-";
  }
  return props.margin.toFixed(3);
});
</script>

<style scoped lang="scss">
.context-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid #dde7f2;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.page-title {
  color: #1b2a41;
  font-size: 24px;
  font-weight: 800;
}

.page-subtitle {
  margin-top: 4px;
  color: #6c7d96;
  font-size: 13px;
}

.context-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.chip {
  min-width: 96px;
  padding: 9px 12px;
  border: 1px solid #dbe7f3;
  border-radius: 12px;
  background: #ffffff;
}

.chip-accent {
  border-color: #b7d8ea;
  background: #eef8fd;
}

.chip-label {
  display: block;
  margin-bottom: 2px;
  color: #7a8ba4;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chip-value {
  color: #203149;
  font-size: 14px;
  font-weight: 700;
}

@media (max-width: 1200px) {
  .context-bar {
    grid-template-columns: 1fr;
  }

  .context-chips {
    justify-content: flex-start;
  }
}
</style>
