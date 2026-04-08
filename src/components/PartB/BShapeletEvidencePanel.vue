<template>
  <el-card class="evidence-card" shadow="never">
    <div class="panel-header">
      <div>
        <div class="title">Shapelet Evidence</div>
        <div class="subtitle">Read what this shapelet actually matches in real samples. Prototype stays on the left.</div>
      </div>
      <div class="header-actions">
        <el-button
          v-if="shapeletId"
          size="small"
          class="stats-trigger"
          @click="emit('open-class-stats')"
        >
          View Class Stats
        </el-button>
        <el-button
          v-if="shapeletId && activeItem"
          size="small"
          class="part-e-trigger"
          @click="openPartE"
        >
          Open Part E
        </el-button>
        <div class="reference" v-if="shapeletId">
          <span>{{ shapeletId }}</span>
          <span v-if="shapeletLength">len {{ shapeletLength }}</span>
          <span>{{ scope }}</span>
        </div>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />

    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="warning"
      show-icon
      :closable="false"
      class="state-alert"
    />

    <el-empty
      v-else-if="!shapeletId"
      description="Select a shapelet first to inspect real matched evidence."
    />

    <el-empty
      v-else-if="!items.length"
      description="No evidence matches are available for the selected shapelet."
    />

    <div v-else class="panel-content">
      <div class="match-list">
        <div class="list-head">
          <div class="list-title">Top Matched Subsequences</div>
          <div class="list-meta">ranked by peak activation · local window length follows shapelet length</div>
        </div>

        <div class="match-items">
          <button
            v-for="item in items"
            :key="`${item.sample_id}-${item.rank}`"
            type="button"
            class="match-item"
            :class="{ active: selectedKey === `${item.sample_id}-${item.rank}` }"
            @click="selectItem(item)"
          >
            <div class="match-main">
              <div class="match-left">
                <div class="match-top">
                  <span class="sample">#{{ item.rank }} · sample {{ item.sample_id }}</span>
                </div>
                <div class="match-mid">
                  <span>window {{ item.t_start }} - {{ item.t_end }}</span>
                  <span>peak_t {{ item.peak_t }}</span>
                </div>
                <div class="match-window">true {{ nullableValue(item.label) }} · pred {{ nullableValue(item.pred_class) }} · margin {{ nullableNumber(item.margin, 3) }}</div>
              </div>
              <div class="match-preview">
                <svg viewBox="0 0 100 44" preserveAspectRatio="none" class="match-preview-svg">
                  <line x1="0" y1="22" x2="100" y2="22" class="mini-divider" />
                  <rect x="0" y="0" width="100" height="16" class="mini-lane raw-mini-lane" />
                  <rect x="0" y="22" width="100" height="22" class="mini-lane act-mini-lane" />
                  <polyline :points="buildMiniRawDetail(item)" class="mini-raw" />
                  <polyline :points="buildMiniActDetail(item)" class="mini-act" />
                </svg>
              </div>
              <div class="match-right">
                <div class="peak">peak {{ formatNumber(item.peak_activation, 3) }}</div>
                <div class="peak-t">peak_t {{ item.peak_t }}</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="detail-pane" v-if="activeItem">
        <div class="overlay-card">
          <el-skeleton v-if="sequenceLoading" :rows="8" animated />
          <c-sequence-evidence-panel
            v-else
            class="embedded-sequence-panel"
            :sequence="sequenceData"
            :active-window="sequenceWindow"
            :prototype="pinnedPrototype"
            :pinned-shapelet-id="shapeletId"
          />
        </div>

      </div>
    </div>

  </el-card>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import axios from "@/scripts/axios.js";
import CSequenceEvidencePanel from "@/components/PartC/CSequenceEvidencePanel.vue";

const emit = defineEmits(["open-class-stats"]);
const router = useRouter();

const props = defineProps({
  datasetName: {
    type: String,
    default: "",
  },
  scope: {
    type: String,
    default: "test",
  },
  shapeletId: {
    type: String,
    default: "",
  },
  omega: {
    type: Number,
    default: 0.1,
  },
  limit: {
    type: Number,
    default: 12,
  },
});

const loading = ref(false);
const errorMessage = ref("");
const items = ref([]);
const warnings = ref([]);
const shapeletLength = ref(0);
const selectedKey = ref("");
const sequenceLoading = ref(false);
const sequenceData = ref([]);
const sequenceWindow = ref(null);
const pinnedPrototype = ref(null);
const activeItem = computed(() => {
  if (!items.value.length) return null;
  const selected = items.value.find((item) => `${item.sample_id}-${item.rank}` === selectedKey.value);
  return selected || items.value[0] || null;
});

const nullableValue = (value) => {
  return value === null || value === undefined ? "-" : String(value);
};

const nullableNumber = (value, digits = 2) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(digits);
};

const formatNumber = (value, digits = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toFixed(digits);
};

const normalizeSeries = (value) => {
  if (!Array.isArray(value)) return [];
  if (!value.length) return [];
  if (Array.isArray(value[0])) {
    return value
      .map((row) => {
        const numbers = row.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        if (!numbers.length) return NaN;
        return numbers.reduce((sum, current) => sum + current, 0) / numbers.length;
      })
      .filter((v) => Number.isFinite(v));
  }
  return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
};

const buildPolyline = (series, x0, x1, yTop, yBottom) => {
  if (!series.length) return "";
  if (series.length === 1) {
    const y = (yTop + yBottom) / 2;
    return `${x0},${y} ${x1},${y}`;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1e-9);
  return series
    .map((value, index) => {
      const ratio = (value - min) / span;
      const x = x0 + ((x1 - x0) * index) / (series.length - 1);
      const y = yBottom - ratio * (yBottom - yTop);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

const buildMiniRawDetail = (item) => buildPolyline(normalizeSeries(item?.raw_window), 2, 98, 6, 20);
const buildMiniActDetail = (item) => buildPolyline(normalizeSeries(item?.activation_window), 2, 98, 24, 42);

const selectItem = (item) => {
  selectedKey.value = `${item.sample_id}-${item.rank}`;
};

const toFallbackWindow = () => {
  if (!activeItem.value) return null;
  return {
    shapelet_id: String(props.shapeletId || ""),
    start: Number(activeItem.value.t_start || 0),
    end: Number(activeItem.value.t_end || 0),
    peak_t: Number(activeItem.value.peak_t || 0),
    triggered: true,
  };
};

const fetchSequenceEvidence = async () => {
  if (!props.datasetName || !props.shapeletId || !activeItem.value) {
    sequenceData.value = [];
    sequenceWindow.value = null;
    pinnedPrototype.value = null;
    return;
  }

  sequenceLoading.value = true;
  try {
    const [matchResponse, prototypeResponse] = await Promise.all([
      axios({
        method: "post",
        url: `v1/part-c/datasets/${props.datasetName}/samples/${activeItem.value.sample_id}/matches`,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          scope: props.scope,
          omega: props.omega,
          shapelet_ids: null,
          topk_shapelets: null,
          pinned_shapelet_id: props.shapeletId,
          include_sequence: true,
          include_prediction: false,
          include_windows: true,
        },
      }),
      axios({
        method: "get",
        url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}`,
      }),
    ]);

    const matchData = matchResponse?.data || {};
    sequenceData.value = Array.isArray(matchData.sequence) ? matchData.sequence : [];
    const windows = Array.isArray(matchData.windows) ? matchData.windows : [];
    sequenceWindow.value =
      windows.find((item) => String(item?.shapelet_id || "") === String(props.shapeletId || "")) || toFallbackWindow();

    const prototype = prototypeResponse?.data?.shapelet?.prototype;
    pinnedPrototype.value = Array.isArray(prototype) ? prototype : null;

    if (!sequenceData.value.length && Array.isArray(activeItem.value.raw_window)) {
      sequenceData.value = activeItem.value.raw_window;
      sequenceWindow.value = {
        shapelet_id: String(props.shapeletId || ""),
        start: 0,
        end: Math.max(0, sequenceData.value.length - 1),
        peak_t: Math.max(
          0,
          Math.min(sequenceData.value.length - 1, Number(activeItem.value.peak_t || 0) - Number(activeItem.value.t_start || 0))
        ),
        triggered: true,
      };
    }
  } catch (error) {
    console.log("error", error);
    sequenceData.value = Array.isArray(activeItem.value?.raw_window) ? activeItem.value.raw_window : [];
    sequenceWindow.value = {
      shapelet_id: String(props.shapeletId || ""),
      start: 0,
      end: Math.max(0, sequenceData.value.length - 1),
      peak_t: Math.max(
        0,
        Math.min(sequenceData.value.length - 1, Number(activeItem.value?.peak_t || 0) - Number(activeItem.value?.t_start || 0))
      ),
      triggered: true,
    };
    pinnedPrototype.value = null;
  } finally {
    sequenceLoading.value = false;
  }
};

const fetchEvidence = async () => {
  if (!props.datasetName || !props.shapeletId) {
    items.value = [];
    warnings.value = [];
    shapeletLength.value = 0;
    errorMessage.value = "";
    selectedKey.value = "";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/evidence/top-matches`,
      params: {
        scope: props.scope,
        limit: props.limit,
      },
    });
    const data = response.data || {};
    items.value = Array.isArray(data.items) ? data.items : [];
    warnings.value = Array.isArray(data.warnings) ? data.warnings : [];
    shapeletLength.value = Number(data.shapelet_length || 0);
    selectedKey.value = items.value.length ? `${items.value[0].sample_id}-${items.value[0].rank}` : "";
  } catch (error) {
    console.log("error", error);
    errorMessage.value = "Failed to load shapelet evidence.";
    items.value = [];
    warnings.value = [];
    shapeletLength.value = 0;
    selectedKey.value = "";
  } finally {
    loading.value = false;
  }
};

const openPartE = () => {
  if (!activeItem.value || !props.datasetName || !props.shapeletId) return;
  router.push({
    name: "WhatIfPanel",
    query: {
      dataset: props.datasetName,
      sample_id: String(activeItem.value.sample_id),
      shapelet_id: String(props.shapeletId),
      t_start: String(activeItem.value.t_start),
      t_end: String(activeItem.value.t_end),
      scope: props.scope,
      omega: String(props.omega),
      source_panel: "part_b",
      rank: String(activeItem.value.rank ?? ""),
      trigger_score: String(activeItem.value.peak_activation ?? ""),
      rank_metric: "peak_activation",
    },
  });
};

watch(
  () => [props.datasetName, props.scope, props.shapeletId, props.limit],
  () => {
    fetchEvidence();
  },
  { immediate: true }
);

watch(
  () => [props.datasetName, props.scope, props.omega, props.shapeletId, selectedKey.value],
  () => {
    fetchSequenceEvidence();
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.evidence-card {
  border: 1px solid #e3e8ef;
  border-radius: 10px;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.el-card__body) {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    min-height: 0;
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.stats-trigger {
  --el-button-bg-color: #eff6ff;
  --el-button-border-color: #bfdbfe;
  --el-button-text-color: #1d4ed8;
  --el-button-hover-bg-color: #dbeafe;
  --el-button-hover-border-color: #93c5fd;
}

.part-e-trigger {
  --el-button-bg-color: #fff7ed;
  --el-button-border-color: #fed7aa;
  --el-button-text-color: #c2410c;
  --el-button-hover-bg-color: #ffedd5;
  --el-button-hover-border-color: #fdba74;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.reference {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 10px;
  border: 1px solid #dbe6f3;
  border-radius: 999px;
  background: #f8fbff;
  font-size: 12px;
  color: #334155;
}

.panel-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 27% 73%;
  gap: 12px;
  overflow: hidden;
}

.match-list,
.detail-pane {
  min-height: 0;
}

.match-list {
  border: 1px solid #e5eaf1;
  border-radius: 10px;
  background: #fbfdff;
  display: flex;
  flex-direction: column;
}

.list-head {
  padding: 12px 12px 10px;
  border-bottom: 1px solid #e7edf5;
}

.list-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.list-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.match-items {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.match-item {
  width: 100%;
  text-align: left;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.match-item:hover {
  border-color: #93c5fd;
  box-shadow: 0 3px 10px rgba(37, 99, 235, 0.08);
}

.match-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.16);
}

.match-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(110px, 22%) auto;
  gap: 10px;
  align-items: center;
}

.match-left {
  min-width: 0;
}

.match-preview {
  min-width: 110px;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.match-preview-svg {
  width: 100%;
  height: 46px;
  border-radius: 6px;
  background: linear-gradient(180deg, #fbfcff 0%, #fbfcff 50%, #fffaf2 50%, #fffaf2 100%);
}

.mini-divider {
  stroke: #e2e8f0;
  stroke-width: 0.8;
}

.match-right {
  min-width: 76px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.match-top,
.match-mid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.match-top {
  margin-bottom: 6px;
}

.sample {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.peak {
  font-size: 12px;
  color: #b45309;
  font-weight: 700;
}

.peak-t {
  font-size: 12px;
  color: #64748b;
}

.match-mid,
.match-window {
  font-size: 12px;
  color: #64748b;
}

.match-window {
  margin-top: 6px;
}

.detail-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  min-height: 0;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  max-width: 1240px;
  align-self: center;
}

.detail-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.detail-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.detail-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #475569;
}

.overlay-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
}

.overlay-card {
  padding: 10px;
  width: 100%;
  max-width: 1240px;
  align-self: flex-start;
  overflow: hidden;
}

.embedded-sequence-panel {
  border: none;
  border-radius: 10px;
  padding: 12px 14px;
  background: #ffffff;
}

.overlay-legend {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.overlay-note {
  font-size: 11px;
  line-height: 1.4;
  color: #64748b;
  text-align: left;
}

.overlay-note span {
  color: #b45309;
  font-weight: 700;
}

.overlay-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.summary-chip {
  border: 1px solid #e6ecf4;
  border-radius: 8px;
  background: #fbfdff;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 11px;
  color: #64748b;
}

.summary-value {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
}

.raw-chip {
  background: #eef2ff;
  color: #0f172a;
}

.act-chip {
  background: #fff2db;
  color: #b45309;
}

.peak-chip {
  background: #fff8e8;
  color: #92400e;
}

.lane-bg {
  fill: #f8fafc;
}

.raw-lane-bg {
  fill: #fbfcff;
}

.act-lane-bg {
  fill: #fffaf2;
}

.peak-band {
  fill: rgba(245, 158, 11, 0.16);
}

.baseline {
  stroke: #d7dee8;
  stroke-width: 0.9;
}

.raw-line {
  fill: none;
  stroke: #111827;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.activation-line {
  fill: none;
  stroke: #f59e0b;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.peak-marker {
  stroke: #d97706;
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}

.evidence-focus {
  width: 100%;
  min-width: 0;
  margin: 0;
  display: grid;
  grid-template-rows: auto auto auto auto auto;
  gap: 10px;
}

.focus-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.focus-row {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.focus-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.focus-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.focus-subtitle {
  font-size: 11px;
  line-height: 1.35;
  color: #64748b;
}

.focus-chart {
  height: 170px;
  border: 1px solid #e6ecf4;
  border-radius: 10px;
  background: #ffffff;
  padding: 8px;
}

.focus-svg {
  width: 100%;
  height: 100%;
}

.focus-timeline {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #475569;
  padding-top: 2px;
}

.focus-peak {
  color: #b45309;
  font-weight: 700;
}

.mini-lane {
  fill: #f8fafc;
}

.raw-mini-lane {
  fill: #fbfcff;
}

.act-mini-lane {
  fill: #fffaf2;
}

.mini-raw {
  fill: none;
  stroke: #111827;
  stroke-width: 1.4;
}

.mini-act {
  fill: none;
  stroke: #f59e0b;
  stroke-width: 1.3;
}

@media (max-width: 1280px) {
  .panel-content {
    grid-template-columns: 30% 70%;
  }

  .match-main {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .match-preview {
    display: none;
  }

  .focus-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
