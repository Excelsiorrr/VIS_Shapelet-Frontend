<template>
  <div class="sequence-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">Raw Sequence Evidence</div>
        <div class="panel-subtitle">
          highlighted window follows the pinned shapelet's center-aligned peak
        </div>
        <div class="panel-context" v-if="activeWindow?.shapelet_id">
          active shapelet {{ activeWindow.shapelet_id }}
        </div>
        <div class="panel-context panel-context-shapelet" v-if="prototypeOverlayPathOverview">
          shapelet overlay (match-stats scaled)
        </div>
      </div>
      <div class="window-chip" v-if="activeWindow">
        window {{ activeWindow.start }} - {{ activeWindow.end }}
      </div>
    </div>

    <div class="sequence-stage sequence-stage-overview">
      <svg class="sequence-svg" viewBox="0 0 960 220" preserveAspectRatio="none">
        <rect
          v-if="maskRects.left"
          :x="maskRects.left.x"
          y="18"
          :width="maskRects.left.width"
          height="168"
          class="outside-mask"
        />
        <rect
          v-if="maskRects.right"
          :x="maskRects.right.x"
          y="18"
          :width="maskRects.right.width"
          height="168"
          class="outside-mask"
        />
        <rect
          v-if="activeWindowRect"
          :x="activeWindowRect.x"
          y="18"
          :width="activeWindowRect.width"
          height="168"
          class="window-band"
        />
        <line
          v-if="peakLineX !== null"
          :x1="peakLineX"
          :x2="peakLineX"
          y1="18"
          y2="186"
          class="peak-line"
        />
        <path :d="sequencePathOverview" class="sequence-line" />
        <path v-if="prototypeOverlayPathOverview" :d="prototypeOverlayPathOverview" class="shapelet-line" />
      </svg>
    </div>

    <div v-if="focusPath" class="focus-block">
      <div class="focus-header">
        <div class="focus-title">Focused Window View</div>
        <div class="focus-subtitle">
          zoomed local pattern around the current matched window
        </div>
      </div>
      <div class="sequence-stage sequence-stage-focus">
        <svg class="sequence-svg" viewBox="0 0 960 220" preserveAspectRatio="none">
          <rect x="28" y="18" width="904" height="168" class="focus-band" />
          <line
            v-if="focusPeakLineX !== null"
            :x1="focusPeakLineX"
            :x2="focusPeakLineX"
            y1="18"
            y2="186"
            class="peak-line"
          />
          <path :d="focusPath" class="sequence-line focus-line" />
          <path v-if="prototypeOverlayPathFocus" :d="prototypeOverlayPathFocus" class="shapelet-line focus-shapelet-line" />
        </svg>
      </div>
    </div>

    <div class="window-metrics">
      <div class="metric">
        <span class="metric-label">start</span>
        <span class="metric-value">{{ activeWindow?.start ?? "-" }}</span>
      </div>
      <div class="metric metric-accent">
        <span class="metric-label">peak_t</span>
        <span class="metric-value">{{ activeWindow?.peak_t ?? "-" }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">end</span>
        <span class="metric-value">{{ activeWindow?.end ?? "-" }}</span>
      </div>
      <div class="metric">
        <span class="metric-label">triggered</span>
        <span class="metric-value">{{ activeWindow ? (activeWindow.triggered ? "yes" : "no") : "-" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  sequence: {
    type: Array,
    default: () => [],
  },
  activeWindow: {
    type: Object,
    default: null,
  },
  prototype: {
    type: Array,
    default: null,
  },
  pinnedShapeletId: {
    type: String,
    default: "",
  },
});

const sequence1d = computed(() => {
  return (props.sequence || []).map((row) => {
    if (Array.isArray(row)) {
      if (!row.length) return 0;
      return row.reduce((sum, value) => sum + Number(value || 0), 0) / row.length;
    }
    return Number(row || 0);
  });
});

const chartPoints = computed(() => {
  return buildChartPoints(sequence1d.value, 960, 220);
});

const buildChartPoints = (values, width = 960, height = 220) => {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * (width - 56) + 28;
    const normalized = (value - min) / range;
    const y = height - 34 - normalized * 134;
    return [x, y];
  });
};

const pathFromPoints = (points) => {
  if (!points.length) return "";
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
};

const sequencePathOverview = computed(() => {
  if (!chartPoints.value.length) return "";
  return pathFromPoints(chartPoints.value);
});

const activeWindowRect = computed(() => {
  if (!props.activeWindow || !sequence1d.value.length) return null;
  const total = sequence1d.value.length;
  const start = Math.max(0, Number(props.activeWindow.start || 0));
  const end = Math.min(total - 1, Number(props.activeWindow.end || 0));
  const left = (start / Math.max(total - 1, 1)) * (960 - 56) + 28;
  const right = (end / Math.max(total - 1, 1)) * (960 - 56) + 28;
  return {
    x: left,
    width: Math.max(8, right - left),
  };
});

const maskRects = computed(() => {
  if (!activeWindowRect.value) return { left: null, right: null };
  const chartLeft = 28;
  const chartRight = 932;
  const leftWidth = Math.max(0, activeWindowRect.value.x - chartLeft);
  const rightX = activeWindowRect.value.x + activeWindowRect.value.width;
  const rightWidth = Math.max(0, chartRight - rightX);
  return {
    left: leftWidth > 0 ? { x: chartLeft, width: leftWidth } : null,
    right: rightWidth > 0 ? { x: rightX, width: rightWidth } : null,
  };
});

const peakLineX = computed(() => {
  if (!props.activeWindow || !sequence1d.value.length) return null;
  const total = sequence1d.value.length;
  const peak = Math.min(total - 1, Math.max(0, Number(props.activeWindow.peak_t || 0)));
  return (peak / Math.max(total - 1, 1)) * (960 - 56) + 28;
});

const focusIndices = computed(() => {
  if (!props.activeWindow || !sequence1d.value.length) return null;
  const total = sequence1d.value.length;
  const start = Math.max(0, Number(props.activeWindow.start || 0));
  const end = Math.min(total - 1, Number(props.activeWindow.end || 0));
  const windowLen = Math.max(1, end - start + 1);
  const padding = Math.max(12, Math.floor(windowLen * 0.35));
  const focusStart = Math.max(0, start - padding);
  const focusEnd = Math.min(total - 1, end + padding);
  return { focusStart, focusEnd };
});

const focusPoints = computed(() => {
  if (!focusIndices.value) return [];
  const values = sequence1d.value.slice(focusIndices.value.focusStart, focusIndices.value.focusEnd + 1);
  return buildChartPoints(values, 960, 220);
});

const focusPath = computed(() => pathFromPoints(focusPoints.value));

const focusPeakLineX = computed(() => {
  if (!focusIndices.value || !props.activeWindow) return null;
  const localPeak = Number(props.activeWindow.peak_t || 0) - focusIndices.value.focusStart;
  const total = Math.max(focusPoints.value.length - 1, 1);
  return (localPeak / total) * (960 - 56) + 28;
});

const prototype1d = computed(() => {
  if (!Array.isArray(props.prototype) || !props.prototype.length) return [];
  return props.prototype.map((row) => {
    if (Array.isArray(row)) {
      if (!row.length) return 0;
      return row.reduce((sum, value) => sum + Number(value || 0), 0) / row.length;
    }
    return Number(row || 0);
  });
});

const buildOverlayValues = (sequenceValues, prototypeValues, start, end, peakT) => {
  if (!sequenceValues.length || !prototypeValues.length) return [];
  const seqLen = sequenceValues.length;
  const st = Math.max(0, Math.min(seqLen - 1, Number(start)));
  const ed = Math.max(st, Math.min(seqLen - 1, Number(end)));
  const winLen = ed - st + 1;
  if (winLen <= 1) return [];

  const protoLen = prototypeValues.length;
  const pad = Math.floor((protoLen - 1) / 2);
  const rawStart = Number(peakT) - pad;
  const protoStart = Math.max(0, -rawStart);
  const protoSlice = prototypeValues.slice(protoStart, protoStart + winLen);
  if (!protoSlice.length) return [];

  const seqWindow = sequenceValues.slice(st, st + protoSlice.length);
  const meanSeq = seqWindow.reduce((s, v) => s + v, 0) / seqWindow.length;
  const stdSeq = Math.sqrt(
    seqWindow.reduce((s, v) => s + (v - meanSeq) * (v - meanSeq), 0) / Math.max(seqWindow.length, 1)
  ) + 1e-6;

  const meanProto = protoSlice.reduce((s, v) => s + v, 0) / protoSlice.length;
  const stdProto = Math.sqrt(
    protoSlice.reduce((s, v) => s + (v - meanProto) * (v - meanProto), 0) / Math.max(protoSlice.length, 1)
  ) + 1e-6;

  return protoSlice.map((value) => ((value - meanProto) / stdProto) * stdSeq + meanSeq);
};

const overlayGlobal = computed(() => {
  if (!props.activeWindow || !sequence1d.value.length || !prototype1d.value.length) return null;
  const start = Number(props.activeWindow.start || 0);
  const end = Number(props.activeWindow.end || 0);
  const peak = Number(props.activeWindow.peak_t || 0);
  const values = buildOverlayValues(sequence1d.value, prototype1d.value, start, end, peak);
  if (!values.length) return null;
  return { start, values };
});

const prototypeOverlayPathOverview = computed(() => {
  if (!overlayGlobal.value || !chartPoints.value.length) return "";
  const start = Math.max(0, overlayGlobal.value.start);
  const indices = overlayGlobal.value.values.map((_, i) => start + i);
  const points = [];
  const min = Math.min(...sequence1d.value);
  const max = Math.max(...sequence1d.value);
  const range = max - min || 1;
  for (let i = 0; i < indices.length; i += 1) {
    const index = indices[i];
    if (index < 0 || index >= sequence1d.value.length) continue;
    const x = (index / Math.max(sequence1d.value.length - 1, 1)) * (960 - 56) + 28;
    const normalized = (overlayGlobal.value.values[i] - min) / range;
    const y = 220 - 34 - normalized * 134;
    points.push([x, y]);
  }
  return pathFromPoints(points);
});

const prototypeOverlayPathFocus = computed(() => {
  if (!focusIndices.value || !overlayGlobal.value) return "";
  const fStart = focusIndices.value.focusStart;
  const fEnd = focusIndices.value.focusEnd;
  const sliceStart = Math.max(fStart, overlayGlobal.value.start);
  const sliceEnd = Math.min(fEnd, overlayGlobal.value.start + overlayGlobal.value.values.length - 1);
  if (sliceEnd < sliceStart) return "";

  const localValues = [];
  for (let idx = sliceStart; idx <= sliceEnd; idx += 1) {
    const protoIdx = idx - overlayGlobal.value.start;
    localValues.push(overlayGlobal.value.values[protoIdx]);
  }
  if (!localValues.length) return "";

  const focusSeq = sequence1d.value.slice(fStart, fEnd + 1);
  const min = Math.min(...focusSeq);
  const max = Math.max(...focusSeq);
  const range = max - min || 1;
  const points = localValues.map((value, i) => {
    const globalIndex = sliceStart + i;
    const localIndex = globalIndex - fStart;
    const x = (localIndex / Math.max(focusSeq.length - 1, 1)) * (960 - 56) + 28;
    const normalized = (value - min) / range;
    const y = 220 - 34 - normalized * 134;
    return [x, y];
  });
  return pathFromPoints(points);
});
</script>

<style scoped lang="scss">
.sequence-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 12px;
  height: 100%;
  padding: 14px 16px;
  border: 1px solid #dde7f2;
  border-radius: 16px;
  background: #ffffff;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  color: #1b2a41;
  font-size: 20px;
  font-weight: 800;
}

.panel-subtitle {
  margin-top: 4px;
  color: #6e8099;
  font-size: 12px;
}

.panel-context {
  margin-top: 6px;
  color: #1d587a;
  font-size: 12px;
  font-weight: 700;
}

.panel-context-shapelet {
  color: #ad6500;
}

.window-chip {
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 999px;
  background: #eef8fd;
  color: #1d587a;
  font-size: 12px;
  font-weight: 700;
}

.sequence-stage {
  min-height: 0;
  padding: 10px 0 0;
  border-top: 1px solid #edf3f9;
  border-bottom: 1px solid #edf3f9;
}

.sequence-stage-overview {
  height: 200px;
}

.sequence-stage-focus {
  height: 200px;
}

.sequence-svg {
  width: 100%;
  height: 100%;
}

.outside-mask {
  fill: rgba(236, 242, 249, 0.72);
}

.window-band {
  fill: rgba(246, 193, 79, 0.18);
}

.focus-band {
  fill: rgba(250, 196, 84, 0.08);
}

.peak-line {
  stroke: #d68c00;
  stroke-width: 2;
  stroke-dasharray: 6 4;
}

.sequence-line {
  fill: none;
  stroke: #182238;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.shapelet-line {
  fill: none;
  stroke: #f0a500;
  stroke-width: 4.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.9;
}

.focus-line {
  stroke-width: 3.4;
}

.focus-shapelet-line {
  stroke-width: 5;
}

.focus-block {
  display: grid;
  grid-template-rows: auto auto;
  gap: 10px;
}

.focus-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.focus-title {
  color: #1b2a41;
  font-size: 14px;
  font-weight: 800;
}

.focus-subtitle {
  color: #6e8099;
  font-size: 12px;
}

.window-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  padding: 10px 12px;
  border: 1px solid #e1eaf4;
  border-radius: 12px;
  background: #fbfdff;
}

.metric-accent {
  border-color: #f6d390;
  background: #fff8e7;
}

.metric-label {
  display: block;
  color: #7a8ba4;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  display: block;
  margin-top: 4px;
  color: #203149;
  font-size: 15px;
  font-weight: 700;
}
</style>
