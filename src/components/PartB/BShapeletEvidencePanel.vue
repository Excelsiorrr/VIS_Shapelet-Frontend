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
                <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="match-preview-svg">
                  <rect x="0" y="0" width="100" height="16" class="mini-lane raw-mini-lane" />
                  <rect x="0" y="16" width="100" height="16" class="mini-lane act-mini-lane" />
                  <polyline :points="buildMiniRaw(item)" class="mini-raw" />
                  <polyline :points="buildMiniAct(item)" class="mini-act" />
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
        <div class="detail-head">
          <div>
            <div class="detail-title">Selected Match Evidence</div>
            <div class="detail-subtitle">
              sample {{ activeItem.sample_id }} · peak_t {{ activeItem.peak_t }} · window {{ activeItem.t_start }} - {{ activeItem.t_end }}
            </div>
          </div>
          <div class="detail-stats">
            <span>peak {{ formatNumber(activeItem.peak_activation, 3) }}</span>
            <span>label {{ nullableValue(activeItem.label) }}</span>
            <span>pred {{ nullableValue(activeItem.pred_class) }}</span>
            <span>margin {{ nullableNumber(activeItem.margin, 3) }}</span>
          </div>
        </div>

        <div class="overlay-card">
          <div class="overlay-layout">
            <div class="overlay-main">
              <div class="overlay-legend">
                <span class="legend-chip raw-chip">raw window</span>
                <span class="legend-chip act-chip">activation window</span>
                <span class="legend-chip peak-chip">peak neighborhood</span>
              </div>
              <div class="evidence-focus">
                <div class="focus-row">
                  <div class="focus-label">
                    <div class="focus-title">Raw window</div>
                    <div class="focus-subtitle">local signal shape in the matched window</div>
                  </div>
                  <div class="focus-chart">
                    <svg viewBox="0 0 100 74" preserveAspectRatio="none" class="focus-svg">
                      <rect x="0" y="6" width="100" height="62" class="lane-bg raw-lane-bg" />
                      <rect
                        :x="peakBand.x.toFixed(2)"
                        y="6"
                        :width="peakBand.width.toFixed(2)"
                        height="62"
                        class="peak-band"
                      />
                      <line x1="0" y1="37" x2="100" y2="37" class="baseline raw-base" />
                      <polyline :points="rawPolyline" class="raw-line" />
                      <line
                        :x1="peakMarkerX.toFixed(2)"
                        y1="8"
                        :x2="peakMarkerX.toFixed(2)"
                        y2="66"
                        class="peak-marker"
                      />
                    </svg>
                  </div>
                </div>

                <div class="focus-row">
                  <div class="focus-label">
                    <div class="focus-title">Activation window</div>
                    <div class="focus-subtitle">shapelet response strength in the same window</div>
                  </div>
                  <div class="focus-chart">
                    <svg viewBox="0 0 100 74" preserveAspectRatio="none" class="focus-svg">
                      <rect x="0" y="6" width="100" height="62" class="lane-bg act-lane-bg" />
                      <rect
                        :x="peakBand.x.toFixed(2)"
                        y="6"
                        :width="peakBand.width.toFixed(2)"
                        height="62"
                        class="peak-band"
                      />
                      <line x1="0" y1="58" x2="100" y2="58" class="baseline act-base" />
                      <polyline :points="activationPolyline" class="activation-line" />
                      <line
                        :x1="peakMarkerX.toFixed(2)"
                        y1="8"
                        :x2="peakMarkerX.toFixed(2)"
                        y2="66"
                        class="peak-marker"
                      />
                    </svg>
                  </div>
                </div>

                <div class="focus-timeline">
                  <span>start {{ activeItem.t_start }}</span>
                  <span class="focus-peak">peak_t {{ activeItem.peak_t }}</span>
                  <span>end {{ activeItem.t_end }}</span>
                </div>
              </div>
            </div>

            <div class="overlay-side">
              <div class="overlay-note">
                darkest point in amber band = strongest match around <span>peak_t {{ activeItem.peak_t }}</span>
              </div>
              <div class="overlay-summary">
                <div class="summary-chip">
                  <span class="summary-label">sample</span>
                  <span class="summary-value">{{ activeItem.sample_id }}</span>
                </div>
                <div class="summary-chip">
                  <span class="summary-label">window</span>
                  <span class="summary-value">{{ activeItem.t_start }}-{{ activeItem.t_end }}</span>
                </div>
                <div class="summary-chip">
                  <span class="summary-label">peak</span>
                  <span class="summary-value">{{ formatNumber(activeItem.peak_activation, 3) }}</span>
                </div>
                <div class="summary-chip">
                  <span class="summary-label">pred</span>
                  <span class="summary-value">{{ nullableValue(activeItem.pred_class) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="comparison-grid">
          <div class="grid-head">
            <div class="grid-title">Quick Comparison</div>
            <div class="grid-meta">top 4 evidence cards</div>
          </div>
          <div class="grid-cards">
            <div
              v-for="item in comparisonItems"
              :key="`mini-${item.sample_id}-${item.rank}`"
              class="mini-card"
              :class="{ active: selectedKey === `${item.sample_id}-${item.rank}` }"
              @click="selectItem(item)"
            >
              <div class="mini-head">
                <span>#{{ item.rank }} · {{ item.sample_id }}</span>
                <span class="mini-peak">{{ formatNumber(item.peak_activation, 3) }}</span>
              </div>
              <svg viewBox="0 0 100 44" preserveAspectRatio="none" class="mini-svg">
                <rect x="0" y="0" width="100" height="22" class="mini-lane raw-mini-lane" />
                <rect x="0" y="22" width="100" height="22" class="mini-lane act-mini-lane" />
                <polyline :points="buildMiniRaw(item)" class="mini-raw" />
                <polyline :points="buildMiniAct(item)" class="mini-act" />
              </svg>
              <div class="mini-meta">window {{ item.t_start }} - {{ item.t_end }}</div>
            </div>
          </div>
        </div>

        <div class="link-preview">
          <div class="link-title">Part C Payload Preview</div>
          <div class="link-code">
            sample_id={{ activeItem.sample_id }} · shapelet_id={{ shapeletId }} · scope={{ scope }} · omega={{ formatNumber(omega, 3) }}
          </div>
        </div>
      </div>
    </div>

  </el-card>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import axios from "@/scripts/axios.js";

const emit = defineEmits(["open-class-stats"]);

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
const activeItem = computed(() => {
  if (!items.value.length) return null;
  const selected = items.value.find((item) => `${item.sample_id}-${item.rank}` === selectedKey.value);
  return selected || items.value[0] || null;
});

const comparisonItems = computed(() => items.value.slice(0, 4));
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

const rawSeries = computed(() => normalizeSeries(activeItem.value?.raw_window));
const activationSeries = computed(() => normalizeSeries(activeItem.value?.activation_window));

const rawPolyline = computed(() => buildPolyline(rawSeries.value, 3, 97, 10, 60));
const activationPolyline = computed(() => buildPolyline(activationSeries.value, 3, 97, 12, 58));

const peakIndex = computed(() => {
  if (!activeItem.value) return 0;
  const value = Number(activeItem.value.peak_t) - Number(activeItem.value.t_start);
  return Math.max(0, Math.min(rawSeries.value.length - 1, Number.isFinite(value) ? value : 0));
});

const peakMarkerX = computed(() => {
  const seriesLength = Math.max(rawSeries.value.length, activationSeries.value.length, 1);
  if (seriesLength <= 1) return 50;
  return 3 + (94 * peakIndex.value) / (seriesLength - 1);
});

const peakBand = computed(() => {
  const seriesLength = Math.max(rawSeries.value.length, activationSeries.value.length, 1);
  const width = seriesLength <= 1 ? 8 : Math.max(5, 94 / seriesLength);
  const x = Math.max(3, Math.min(97 - width, peakMarkerX.value - width / 2));
  return { x, width };
});

const buildMiniRaw = (item) => buildPolyline(normalizeSeries(item?.raw_window), 2, 98, 8, 26);
const buildMiniAct = (item) => buildPolyline(normalizeSeries(item?.activation_window), 2, 98, 28, 42);

const selectItem = (item) => {
  selectedKey.value = `${item.sample_id}-${item.rank}`;
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

watch(
  () => [props.datasetName, props.scope, props.shapeletId, props.limit],
  () => {
    fetchEvidence();
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
  height: 38px;
  border-radius: 6px;
  background: linear-gradient(180deg, #fbfcff 0%, #fbfcff 50%, #fffaf2 50%, #fffaf2 100%);
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
  display: grid;
  grid-template-rows: auto minmax(220px, 1.2fr) minmax(132px, 0.8fr) auto;
  gap: 10px;
  overflow: hidden;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
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

.overlay-card,
.link-preview,
.comparison-grid {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
}

.overlay-card {
  padding: 10px;
}

.overlay-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 12px;
  align-items: start;
}

.overlay-main {
  min-width: 0;
}

.overlay-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.activation-line {
  fill: none;
  stroke: #f59e0b;
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.peak-marker {
  stroke: #d97706;
  stroke-width: 1.2;
  stroke-dasharray: 4 4;
}

.evidence-focus {
  width: 100%;
  min-width: 0;
  margin: 0;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 8px;
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
  height: 84px;
  border: 1px solid #e6ecf4;
  border-radius: 10px;
  background: #ffffff;
  padding: 6px;
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

.comparison-grid {
  min-height: 0;
  padding: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.grid-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}

.grid-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.grid-meta {
  font-size: 12px;
  color: #64748b;
}

.grid-cards {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 260px);
  gap: 8px;
  align-content: start;
  padding-bottom: 2px;
}

.mini-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 7px;
  background: #f8fafc;
  cursor: pointer;
  min-width: 0;
}

.mini-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.mini-head {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: center;
}

.mini-peak {
  color: #b45309;
  font-size: 11px;
}

.mini-svg {
  width: 100%;
  height: 44px;
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
  stroke-width: 2.2;
}

.mini-act {
  fill: none;
  stroke: #f59e0b;
  stroke-width: 2;
}

.mini-meta {
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
}

.link-preview {
  padding: 10px 12px;
}

.link-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.link-code {
  margin-top: 6px;
  font-size: 12px;
  color: #475569;
  word-break: break-word;
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

  .overlay-layout {
    grid-template-columns: 1fr;
  }

  .overlay-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .focus-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
