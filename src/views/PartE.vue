<template>
  <div class="part-e-page">
    <div class="part-e-layout">
      <el-card shadow="never" class="context-card">
        <div class="context-title">Part E · What-If</div>
        <div class="context-grid">
          <span>dataset: {{ datasetName }}</span>
          <span>sample: {{ sampleId || "-" }}</span>
          <span>shapelet: {{ shapeletId || "-" }}</span>
          <span>scope: {{ scope }}</span>
          <span>omega: {{ omega }}</span>
          <span>source: {{ sourcePanel }}</span>
        </div>
      </el-card>

      <el-card shadow="never" class="plot-card">
        <div class="section-head">
          <div class="section-title">Sequence + Activation</div>
          <div class="section-subtitle">
            drag on the chart to add spans, then run single or multiple what-if tests
          </div>
        </div>

        <el-alert
          v-if="matchError"
          type="warning"
          :title="matchError"
          show-icon
          :closable="false"
          class="state-alert"
        />
        <el-skeleton v-else-if="matchLoading" :rows="6" animated />
        <div v-else-if="plotReady" ref="plotRef" class="plot-area" @mousedown="onPlotDown" @mousemove="onPlotMove" @mouseup="onPlotUp" @mouseleave="onPlotUp">
          <svg class="plot-svg" viewBox="0 0 1000 320" preserveAspectRatio="none">
            <rect x="0" y="0" width="1000" height="320" class="plot-bg" />
            <line x1="0" y1="160" x2="1000" y2="160" class="divider" />

            <polyline :points="sequencePolyline" class="raw-line" />
            <polyline :points="activationPolyline" class="activation-line" />

            <g v-for="item in spans" :key="item.id">
              <rect :x="spanToX(item.start)" y="0" :width="spanWidth(item)" height="320" class="span-band" :class="{ active: String(item.id) === String(activeSpanId) }" />
            </g>

            <rect
              v-if="draftSpan"
              :x="spanToX(draftSpan.start)"
              y="0"
              :width="spanWidth(draftSpan)"
              height="320"
              class="draft-band"
            />
          </svg>
        </div>
        <el-empty v-else description="No sequence/activation available for this sample + shapelet." />
      </el-card>

      <el-card shadow="never" class="control-card">
        <div class="section-title">Controls</div>
        <div class="control-grid">
          <label>
            <span>t_start</span>
            <el-input-number v-model="tStart" :step="1" />
          </label>
          <label>
            <span>t_end</span>
            <el-input-number v-model="tEnd" :step="1" />
          </label>
          <label>
            <span>baseline</span>
            <el-select v-model="baseline">
              <el-option label="linear_interp" value="linear_interp" />
              <el-option label="zero" value="zero" />
              <el-option label="dataset_mean" value="dataset_mean" />
            </el-select>
          </label>
          <label>
            <span>value_type</span>
            <el-select v-model="valueType">
              <el-option label="prob" value="prob" />
              <el-option label="logit" value="logit" />
            </el-select>
          </label>
          <label>
            <span>target_class</span>
            <el-input-number v-model="targetClassInput" :step="1" :min="0" />
          </label>
          <label class="switch-line">
            <span>include_perturbed_sequence</span>
            <el-switch v-model="includePerturbedSequence" />
          </label>
        </div>

        <div class="span-actions">
          <el-button size="small" :disabled="!canAddCurrentSpan" @click="addCurrentSpan">Add Current Span</el-button>
          <el-button size="small" :disabled="!spans.length" @click="clearSpans">Clear Spans</el-button>
        </div>

        <div class="span-list" v-if="spans.length">
          <button
            v-for="item in spans"
            :key="item.id"
            type="button"
            class="span-item"
            :class="{ active: String(item.id) === String(activeSpanId) }"
            @click="focusSpan(item.id)"
          >
            <span>[{{ item.start }}, {{ item.end }}]</span>
            <span class="len">len {{ item.end - item.start + 1 }}</span>
            <span class="delete" @click.stop="removeSpan(item.id)">remove</span>
          </button>
        </div>

        <div class="action-row">
          <el-button type="primary" :disabled="!canRun" :loading="loading" @click="runWhatIf">
            Run What-If ({{ runSpanCount }})
          </el-button>
          <el-button :disabled="!canBackToSource" @click="backToSource">{{ backButtonText }}</el-button>
          <el-button :disabled="!canCopy" @click="copyPayload">Copy Payload</el-button>
        </div>
      </el-card>

      <el-empty
        v-if="!hasRequiredInput"
        description="Part E requires dataset, sample_id, shapelet_id, t_start, and t_end."
      />

      <template v-else>
        <el-alert
          v-if="errorMessage"
          type="error"
          :title="errorMessage"
          show-icon
          :closable="false"
        />

        <el-skeleton v-else-if="loading && !result" :rows="7" animated />

        <el-card v-else-if="result" shadow="never" class="result-card">
          <div class="section-title">Primary Result</div>
          <div class="result-grid">
            <div class="metric">
              <span>span</span>
              <strong>[{{ result.span.start }}, {{ result.span.end }}]</strong>
            </div>
            <div class="metric">
              <span>p_original</span>
              <strong>{{ formatNumber(result.data.p_original) }}</strong>
            </div>
            <div class="metric">
              <span>p_whatif</span>
              <strong>{{ formatNumber(result.data.p_whatif) }}</strong>
            </div>
            <div class="metric">
              <span>delta = p_whatif - p_original</span>
              <strong :class="{ positive: result.data.delta > 0, negative: result.data.delta < 0 }">
                {{ formatNumber(result.data.delta) }}
              </strong>
            </div>
            <div class="metric">
              <span>pred class (orig -> whatif)</span>
              <strong>{{ result.data.pred_class_original }} -> {{ result.data.pred_class_whatif }}</strong>
            </div>
            <div class="metric">
              <span>delta_target</span>
              <strong>{{ result.data.delta_target === null ? "-" : formatNumber(result.data.delta_target) }}</strong>
            </div>
          </div>
        </el-card>

        <el-card v-if="spanResults.length > 1" shadow="never" class="multi-result-card">
          <div class="section-title">Multi-Span Results</div>
          <el-table :data="spanResults" size="small" border style="width: 100%">
            <el-table-column label="Span">
              <template #default="{ row }">[{{ row.span.start }}, {{ row.span.end }}]</template>
            </el-table-column>
            <el-table-column label="p_original">
              <template #default="{ row }">{{ formatNumber(row.data.p_original) }}</template>
            </el-table-column>
            <el-table-column label="p_whatif">
              <template #default="{ row }">{{ formatNumber(row.data.p_whatif) }}</template>
            </el-table-column>
            <el-table-column label="delta">
              <template #default="{ row }">{{ formatNumber(row.data.delta) }}</template>
            </el-table-column>
            <el-table-column label="Pred">
              <template #default="{ row }">{{ row.data.pred_class_original }} -> {{ row.data.pred_class_whatif }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card
          v-if="result && includePerturbedSequence && Array.isArray(result.data.perturbed_sequence)"
          shadow="never"
          class="sequence-card"
        >
          <div class="section-title">Perturbed Sequence Snapshot</div>
          <div class="sequence-meta">
            length: {{ result.data.perturbed_sequence.length }}
          </div>
          <pre class="sequence-preview">{{ sequencePreview }}</pre>
        </el-card>

        <el-card
          v-if="allWarnings.length"
          shadow="never"
          class="warning-card"
        >
          <div class="section-title">Warnings</div>
          <el-alert
            v-for="(item, index) in allWarnings"
            :key="`${item.code || 'warn'}-${index}`"
            type="warning"
            :title="item.title"
            show-icon
            :closable="false"
            class="warning-item"
          />
        </el-card>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "@/scripts/axios.js";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const errorMessage = ref("");
const result = ref(null);
const spanResults = ref([]);

const tStart = ref(0);
const tEnd = ref(0);
const scope = ref("test");
const omega = ref(0.02);
const baseline = ref("linear_interp");
const valueType = ref("prob");
const targetClassInput = ref(null);
const includePerturbedSequence = ref(false);

const plotRef = ref(null);
const sequenceSeries = ref([]);
const activationSeries = ref([]);
const matchLoading = ref(false);
const matchError = ref("");

const spans = ref([]);
const activeSpanId = ref("");
const draftSpan = ref(null);
const brushStart = ref(null);
let spanSeed = 1;

const datasetName = computed(() => String(route.query.dataset || localStorage.getItem("shapeletDataset") || "mcce"));
const sampleId = computed(() => String(route.query.sample_id || ""));
const shapeletId = computed(() => String(route.query.shapelet_id || ""));
const sourcePanel = computed(() => String(route.query.source_panel || "part_b"));

const parseNumber = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const extractErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail?.message === "string" && detail.message.trim()) return detail.message;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return fallback;
};

const hasRequiredInput = computed(() => {
  return Boolean(
    datasetName.value &&
      sampleId.value &&
      shapeletId.value &&
      Number.isFinite(Number(tStart.value)) &&
      Number.isFinite(Number(tEnd.value))
  );
});

const canRun = computed(() => hasRequiredInput.value && Number(tStart.value) <= Number(tEnd.value) && !loading.value);
const canCopy = computed(() => hasRequiredInput.value);
const canBackToSource = computed(() => Boolean(datasetName.value && sampleId.value && shapeletId.value));
const backButtonText = computed(() => (sourcePanel.value === "part_c" ? "Back to Part C" : "Back to Part B"));
const canAddCurrentSpan = computed(() => Number.isFinite(Number(tStart.value)) && Number.isFinite(Number(tEnd.value)) && Number(tStart.value) <= Number(tEnd.value));
const runSpanCount = computed(() => (spans.value.length ? spans.value.length : 1));
const plotReady = computed(() => sequenceSeries.value.length > 1 && activationSeries.value.length > 1);
const seriesLength = computed(() => Math.max(sequenceSeries.value.length, activationSeries.value.length, 1));

const sequencePreview = computed(() => {
  const seq = result.value?.data?.perturbed_sequence;
  if (!Array.isArray(seq)) return "";
  return JSON.stringify(seq.slice(0, 20), null, 2);
});

const allWarnings = computed(() => {
  const out = [];
  spanResults.value.forEach((item) => {
    const warnings = Array.isArray(item?.data?.warnings) ? item.data.warnings : [];
    warnings.forEach((w) => {
      out.push({
        title: `[${item.span.start},${item.span.end}] ${w.code}: ${w.message}`,
        code: w.code,
      });
    });
  });
  return out;
});

const normalizeSeries = (value) => {
  if (!Array.isArray(value) || !value.length) return [];
  if (Array.isArray(value[0])) {
    return value
      .map((row) => {
        const nums = row.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        if (!nums.length) return NaN;
        return nums.reduce((sum, item) => sum + item, 0) / nums.length;
      })
      .filter((v) => Number.isFinite(v));
  }
  return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
};

const toPolyline = (series, yTop, yBottom) => {
  if (!series.length) return "";
  if (series.length === 1) return `0,${(yTop + yBottom) / 2} 1000,${(yTop + yBottom) / 2}`;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1e-9);
  return series
    .map((value, idx) => {
      const x = (idx / (series.length - 1)) * 1000;
      const ratio = (value - min) / span;
      const y = yBottom - ratio * (yBottom - yTop);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

const sequencePolyline = computed(() => toPolyline(sequenceSeries.value, 12, 148));
const activationPolyline = computed(() => toPolyline(activationSeries.value, 172, 308));

const clampIndex = (value) => Math.max(0, Math.min(seriesLength.value - 1, Number(value)));
const normalizeSpan = (start, end) => {
  const s = clampIndex(Math.min(start, end));
  const e = clampIndex(Math.max(start, end));
  return { start: s, end: e };
};

const spanToX = (idx) => {
  if (seriesLength.value <= 1) return 0;
  return (clampIndex(idx) / (seriesLength.value - 1)) * 1000;
};

const spanWidth = (span) => {
  const x1 = spanToX(span.start);
  const x2 = spanToX(span.end);
  return Math.max(2, x2 - x1);
};

const xToIndex = (clientX) => {
  const el = plotRef.value;
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
  return clampIndex(Math.round(ratio * (seriesLength.value - 1)));
};

const focusSpan = (id) => {
  const item = spans.value.find((it) => String(it.id) === String(id));
  if (!item) return;
  activeSpanId.value = String(item.id);
  tStart.value = item.start;
  tEnd.value = item.end;
};

const addSpan = (start, end) => {
  const normalized = normalizeSpan(start, end);
  const exists = spans.value.some((item) => item.start === normalized.start && item.end === normalized.end);
  if (exists) {
    const existed = spans.value.find((item) => item.start === normalized.start && item.end === normalized.end);
    activeSpanId.value = String(existed?.id || "");
    return;
  }
  const item = {
    id: spanSeed++,
    start: normalized.start,
    end: normalized.end,
  };
  spans.value = [...spans.value, item].sort((a, b) => a.start - b.start);
  activeSpanId.value = String(item.id);
  tStart.value = item.start;
  tEnd.value = item.end;
};

const addCurrentSpan = () => {
  if (!canAddCurrentSpan.value) return;
  addSpan(Number(tStart.value), Number(tEnd.value));
};

const removeSpan = (id) => {
  spans.value = spans.value.filter((item) => String(item.id) !== String(id));
  if (String(activeSpanId.value) === String(id)) {
    activeSpanId.value = spans.value.length ? String(spans.value[0].id) : "";
    if (spans.value.length) {
      tStart.value = spans.value[0].start;
      tEnd.value = spans.value[0].end;
    }
  }
};

const clearSpans = () => {
  spans.value = [];
  activeSpanId.value = "";
};

const onPlotDown = (event) => {
  if (!plotReady.value) return;
  const idx = xToIndex(event.clientX);
  brushStart.value = idx;
  draftSpan.value = { start: idx, end: idx };
};

const onPlotMove = (event) => {
  if (brushStart.value === null) return;
  const idx = xToIndex(event.clientX);
  draftSpan.value = normalizeSpan(brushStart.value, idx);
};

const onPlotUp = () => {
  if (brushStart.value === null || !draftSpan.value) {
    brushStart.value = null;
    draftSpan.value = null;
    return;
  }
  addSpan(draftSpan.value.start, draftSpan.value.end);
  brushStart.value = null;
  draftSpan.value = null;
};

const syncFromQuery = () => {
  tStart.value = parseNumber(route.query.t_start, 0);
  tEnd.value = parseNumber(route.query.t_end, 0);
  scope.value = String(route.query.scope || "test");
  omega.value = parseNumber(route.query.omega, 0.02);
  baseline.value = String(route.query.baseline || "linear_interp");
  valueType.value = String(route.query.value_type || "prob");
  targetClassInput.value = parseNumber(route.query.target_class);
  spans.value = [];
  activeSpanId.value = "";
  addSpan(Number(tStart.value), Number(tEnd.value));
};

const buildPayload = (span) => ({
  shapelet_id: shapeletId.value,
  t_start: span.start,
  t_end: span.end,
  scope: scope.value,
  omega: Number(omega.value),
  baseline: baseline.value,
  value_type: valueType.value,
  target_class: Number.isFinite(Number(targetClassInput.value)) ? Number(targetClassInput.value) : null,
  seed: 2026,
  include_perturbed_sequence: includePerturbedSequence.value,
});

const loadSequenceAndActivation = async () => {
  if (!datasetName.value || !sampleId.value || !shapeletId.value) {
    sequenceSeries.value = [];
    activationSeries.value = [];
    return;
  }
  matchLoading.value = true;
  matchError.value = "";
  try {
    const response = await axios({
      method: "post",
      url: `v1/part-c/datasets/${datasetName.value}/samples/${sampleId.value}/matches`,
      headers: { "Content-Type": "application/json" },
      data: {
        scope: scope.value,
        omega: Number(omega.value),
        shapelet_ids: null,
        topk_shapelets: null,
        pinned_shapelet_id: shapeletId.value,
        include_sequence: true,
        include_prediction: false,
        include_windows: true,
      },
    });
    const data = response.data || {};
    sequenceSeries.value = normalizeSeries(data.sequence);

    const shapeletIds = Array.isArray(data.shapelet_ids) ? data.shapelet_ids.map((x) => String(x)) : [];
    const matrix = Array.isArray(data.I) ? data.I : [];
    const rowIdx = shapeletIds.findIndex((id) => id === shapeletId.value);
    if (rowIdx >= 0 && Array.isArray(matrix[rowIdx])) {
      activationSeries.value = normalizeSeries(matrix[rowIdx]);
    } else {
      activationSeries.value = [];
    }
  } catch (error) {
    console.log("error", error);
    matchError.value = extractErrorMessage(error, "Failed to load sequence and activation context.");
    sequenceSeries.value = [];
    activationSeries.value = [];
  } finally {
    matchLoading.value = false;
  }
};

const runWhatIf = async () => {
  if (!canRun.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    const targets = spans.value.length
      ? spans.value.map((item) => ({ start: item.start, end: item.end }))
      : [normalizeSpan(Number(tStart.value), Number(tEnd.value))];

    const outputs = [];
    for (const span of targets) {
      const response = await axios({
        method: "post",
        url: `v1/part-e/datasets/${datasetName.value}/samples/${sampleId.value}/whatif:evaluate`,
        headers: { "Content-Type": "application/json" },
        data: buildPayload(span),
      });
      outputs.push({
        span,
        data: response.data || null,
      });
    }

    spanResults.value = outputs.filter((item) => item.data);
    result.value = spanResults.value.length ? spanResults.value[0] : null;
    if (result.value?.data) {
      tStart.value = result.value.data.t_start;
      tEnd.value = result.value.data.t_end;
    }
  } catch (error) {
    console.log("error", error);
    errorMessage.value = extractErrorMessage(error, "Failed to evaluate what-if.");
  } finally {
    loading.value = false;
  }
};

const copyPayload = async () => {
  const payload = {
    dataset: datasetName.value,
    sample_id: sampleId.value,
    shapelet_id: shapeletId.value,
    scope: scope.value,
    omega: Number(omega.value),
    spans: spans.value.length
      ? spans.value.map((item) => ({ t_start: item.start, t_end: item.end }))
      : [{ t_start: Number(tStart.value), t_end: Number(tEnd.value) }],
    source_panel: "part_e",
    baseline: baseline.value,
    value_type: valueType.value,
    target_class: Number.isFinite(Number(targetClassInput.value)) ? Number(targetClassInput.value) : null,
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.log("clipboard error", error);
  }
};

const backToSource = () => {
  if (!canBackToSource.value) return;
  const primary = spans.value.length
    ? spans.value.find((item) => String(item.id) === String(activeSpanId.value)) || spans.value[0]
    : normalizeSpan(Number(tStart.value), Number(tEnd.value));

  if (sourcePanel.value === "part_c") {
    router.push({
      name: "MatchLocatePanel",
      query: {
        dataset: datasetName.value,
        sample_id: sampleId.value,
        shapelet_id: shapeletId.value,
        t_start: String(primary.start),
        t_end: String(primary.end),
        scope: scope.value,
        omega: String(omega.value),
        source_panel: "part_e",
        baseline: baseline.value,
        value_type: valueType.value,
        target_class: Number.isFinite(Number(targetClassInput.value)) ? String(targetClassInput.value) : undefined,
      },
    });
    return;
  }

  router.push({
    name: "ShapeletLibraryPanel",
    query: {
      dataset: datasetName.value,
      shapelet_id: shapeletId.value,
      scope: scope.value,
      omega: String(omega.value),
      source_panel: "part_e",
    },
  });
};

const formatNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toFixed(6);
};

watch(
  () => route.query,
  () => {
    syncFromQuery();
    loadSequenceAndActivation();
    if (hasRequiredInput.value) {
      runWhatIf();
    } else {
      result.value = null;
      spanResults.value = [];
      errorMessage.value = "";
    }
  },
  { deep: true }
);

watch(
  () => [datasetName.value, sampleId.value, shapeletId.value, scope.value, omega.value],
  () => {
    loadSequenceAndActivation();
  }
);

onMounted(() => {
  syncFromQuery();
  loadSequenceAndActivation();
  if (hasRequiredInput.value) {
    runWhatIf();
  }
});
</script>

<style scoped lang="scss">
.part-e-page {
  width: 100%;
  min-height: 100%;
  padding: 10px 12px;
  box-sizing: border-box;
  background: #f7f9fb;
}

.part-e-layout {
  display: grid;
  gap: 12px;
}

.context-card,
.plot-card,
.control-card,
.result-card,
.multi-result-card,
.warning-card,
.sequence-card {
  border: 1px solid #dde7f2;
}

.context-title,
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1b2a41;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.section-subtitle {
  font-size: 12px;
  color: #6e8099;
}

.context-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  font-size: 13px;
  color: #425466;
}

.plot-area {
  margin-top: 10px;
  height: 320px;
  border: 1px solid #d9e4f1;
  border-radius: 8px;
  overflow: hidden;
  cursor: crosshair;
}

.plot-svg {
  width: 100%;
  height: 100%;
}

.plot-bg {
  fill: #ffffff;
}

.divider {
  stroke: #dbe7f3;
  stroke-width: 1;
}

.raw-line {
  fill: none;
  stroke: #0f172a;
  stroke-width: 1.8;
}

.activation-line {
  fill: none;
  stroke: #f59e0b;
  stroke-width: 1.8;
}

.span-band {
  fill: rgba(37, 99, 235, 0.12);
  stroke: rgba(37, 99, 235, 0.35);
  stroke-width: 1;
}

.span-band.active {
  fill: rgba(30, 64, 175, 0.18);
  stroke: rgba(30, 64, 175, 0.6);
}

.draft-band {
  fill: rgba(245, 158, 11, 0.16);
  stroke: rgba(217, 119, 6, 0.65);
  stroke-width: 1;
  stroke-dasharray: 5 3;
}

.control-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.control-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #5f7288;
}

.switch-line {
  justify-content: center;
}

.span-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.span-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.span-item {
  border: 1px solid #d9e4f1;
  border-radius: 8px;
  background: #f8fbff;
  padding: 8px 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-start;
  color: #334155;
  cursor: pointer;
}

.span-item.active {
  border-color: #3b82f6;
  background: #eef5ff;
}

.span-item .len {
  color: #64748b;
  font-size: 12px;
}

.span-item .delete {
  margin-left: auto;
  color: #b45309;
  font-size: 12px;
}

.action-row {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.result-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.metric {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric span {
  font-size: 12px;
  color: #6e8099;
}

.metric strong {
  font-size: 16px;
  color: #1b2a41;
}

.metric strong.positive {
  color: #b45309;
}

.metric strong.negative {
  color: #0369a1;
}

.warning-item + .warning-item {
  margin-top: 8px;
}

.sequence-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}

.sequence-preview {
  margin-top: 8px;
  max-height: 240px;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafcff;
  padding: 8px;
  font-size: 12px;
}

.state-alert {
  margin-top: 10px;
}

@media (max-width: 900px) {
  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
