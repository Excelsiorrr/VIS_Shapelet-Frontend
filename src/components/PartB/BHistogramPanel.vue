<template>
  <el-card class="matrix-card" shadow="never">
    <div class="panel-header">
      <div>
        <div class="title">I-Value Overview</div>
      </div>
      <div class="meta">
        <span>scope={{ scope }}</span>
        <span>omega={{ omegaText }}</span>
        <span v-if="lastUpdatedText" class="updated-at">updated {{ lastUpdatedText }}</span>
        <el-button
          size="small"
          :disabled="loading || !shapeletId || !datasetName"
          @click="fetchMatrixSummary"
        >
          Refresh
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="warning"
      show-icon
      :closable="false"
      class="state-alert"
    />

    <el-empty
      v-else-if="!shapeletId"
      description="Please select a shapelet from gallery."
    />

    <div v-else class="panel-body">
      <div class="summary-card">
        <div class="summary-head">
          <div class="section-title">Summary Band</div>
          <div class="section-meta">median / q25 / q75 / exceed ratio</div>
        </div>
        <div class="summary-shell">
          <div ref="summaryChartRef" class="chart-view"></div>
          <div v-if="loading" class="chart-overlay">Loading overview...</div>
          <div v-else-if="!hasMatrixData" class="chart-overlay muted">No summary data.</div>
        </div>
      </div>

      <div class="heatmap-card">
        <div class="heatmap-head">
          <div class="section-title">Sorted Heatmap</div>
          <div class="section-meta">
            {{ matrixMetaText }}
          </div>
        </div>
        <div class="heatmap-shell">
          <div ref="heatmapChartRef" class="chart-view"></div>
          <div v-if="loading" class="chart-overlay">Loading matrix...</div>
          <div v-else-if="!hasMatrixData" class="chart-overlay muted">No matrix data.</div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import axios from "@/scripts/axios.js";

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
});

const summaryChartRef = ref(null);
const heatmapChartRef = ref(null);
let summaryChart = null;
let heatmapChart = null;

const loading = ref(false);
const errorMessage = ref("");
const matrixData = ref(null);
const lastUpdated = ref(null);

const omegaText = computed(() => Number(props.omega || 0).toFixed(2));
const lastUpdatedText = computed(() => {
  if (!lastUpdated.value) return "";
  const d = new Date(lastUpdated.value);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
});
const hasMatrixData = computed(() => {
  const data = matrixData.value;
  return !!(
    data &&
    Array.isArray(data.matrix) &&
    data.matrix.length &&
    Array.isArray(data.matrix[0]) &&
    data.matrix[0].length
  );
});
const matrixMetaText = computed(() => {
  const data = matrixData.value;
  if (!data) return "";
  return `rows=${data.row_bins}  time-bins=${data.time_bins}  sort=${data.sort_mode}  agg=${data.aggregation}`;
});

const initCharts = () => {
  if (summaryChartRef.value && !summaryChart) {
    summaryChart = echarts.init(summaryChartRef.value);
  }
  if (heatmapChartRef.value && !heatmapChart) {
    heatmapChart = echarts.init(heatmapChartRef.value);
  }
};

const disposeCharts = () => {
  if (summaryChart) {
    summaryChart.dispose();
    summaryChart = null;
  }
  if (heatmapChart) {
    heatmapChart.dispose();
    heatmapChart = null;
  }
};

const renderSummaryChart = () => {
  initCharts();
  if (!summaryChart) return;
  if (!hasMatrixData.value) {
    summaryChart.clear();
    return;
  }

  const data = matrixData.value;
  const xValues = data.summary_median.map((_, i) => i);
  summaryChart.setOption(
    {
      animation: false,
      grid: {
        left: 42,
        right: 18,
        top: 18,
        bottom: 28,
      },
      tooltip: {
        trigger: "axis",
      },
      legend: {
        right: 0,
        top: 0,
        textStyle: {
          color: "#64748b",
          fontSize: 11,
        },
      },
      xAxis: {
        type: "category",
        data: xValues,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          interval: Math.max(0, Math.floor(xValues.length / 6)),
        },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: [
        {
          type: "value",
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
          },
          splitLine: { lineStyle: { color: "#eef2f7" } },
        },
        {
          type: "value",
          min: 0,
          max: 1,
          axisLabel: {
            color: "#94a3b8",
            fontSize: 10,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "q25",
          type: "line",
          data: data.summary_q25,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: "#cbd5e1",
            width: 1.5,
            type: "dashed",
          },
        },
        {
          name: "median",
          type: "line",
          data: data.summary_median,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: "#2563eb",
            width: 2.5,
          },
        },
        {
          name: "q75",
          type: "line",
          data: data.summary_q75,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: "#93c5fd",
            width: 1.5,
            type: "dashed",
          },
        },
        {
          name: "exceed",
          type: "line",
          yAxisIndex: 1,
          data: data.exceed_ratio,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: "#f97316",
            width: 2,
          },
          areaStyle: {
            color: "rgba(249, 115, 22, 0.10)",
          },
        },
      ],
    },
    true
  );
};

const renderHeatmapChart = () => {
  initCharts();
  if (!heatmapChart) return;
  if (!hasMatrixData.value) {
    heatmapChart.clear();
    return;
  }

  const data = matrixData.value;
  const rows = data.matrix.length;
  const cols = data.matrix[0].length;
  const heatmapData = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      heatmapData.push([x, y, data.matrix[y][x]]);
    }
  }

  heatmapChart.setOption(
    {
      animation: false,
      grid: {
        left: 52,
        right: 62,
        top: 20,
        bottom: 36,
      },
      tooltip: {
        position: "top",
        formatter: (params) => {
          const [x, y, v] = params.data || [];
          return `time-bin: ${x}<br/>row: ${y}<br/>I: ${Number(v).toFixed(4)}`;
        },
      },
      xAxis: {
        type: "category",
        data: Array.from({ length: cols }, (_, i) => i),
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          interval: Math.max(0, Math.floor(cols / 6)),
        },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: {
        type: "category",
        data: Array.from({ length: rows }, (_, i) => i),
        axisLabel: {
          show: false,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: Number(data.value_range?.[0] ?? 0),
        max: Number(data.value_range?.[1] ?? 1),
        calculable: false,
        orient: "vertical",
        right: 6,
        top: "middle",
        itemHeight: 180,
        text: ["high", "low"],
        textStyle: {
          color: "#64748b",
          fontSize: 11,
        },
        inRange: {
          color: ["#f8fbff", "#dceeff", "#8ec5ff", "#347eeb", "#123e93"],
        },
      },
      series: [
        {
          type: "heatmap",
          data: heatmapData,
          progressive: 0,
          emphasis: {
            itemStyle: {
              borderColor: "#0f172a",
              borderWidth: 0.4,
            },
          },
        },
      ],
    },
    true
  );
};

const renderCharts = async () => {
  await nextTick();
  renderSummaryChart();
  renderHeatmapChart();
};

const fetchMatrixSummary = async () => {
  if (!props.datasetName || !props.shapeletId) {
    matrixData.value = null;
    errorMessage.value = "";
    lastUpdated.value = null;
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/stats/matrix-summary`,
      params: {
        scope: props.scope || "test",
        omega: props.omega,
        time_bins: 180,
        row_bins: 120,
        aggregation: "max",
        normalization: "none",
        sort_mode: "peak_position",
      },
    });
    matrixData.value = response.data || null;
    lastUpdated.value = Date.now();
    await renderCharts();
  } catch (error) {
    console.log("error", error);
    errorMessage.value = "Failed to load I-value overview.";
    matrixData.value = null;
    renderSummaryChart();
    renderHeatmapChart();
  } finally {
    loading.value = false;
  }
};

const onWindowResize = () => {
  if (summaryChart) summaryChart.resize();
  if (heatmapChart) heatmapChart.resize();
};

watch(
  () => [props.datasetName, props.scope, props.shapeletId, props.omega],
  () => {
    fetchMatrixSummary();
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("resize", onWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onWindowResize);
  disposeCharts();
});
</script>

<style scoped lang="scss">
.matrix-card {
  border: 1px solid #eaecef;
  border-radius: 10px;
  min-height: 0;
  height: 100%;

  :deep(.el-card__body) {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #64748b;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .updated-at {
    color: #94a3b8;
  }

  .state-alert {
    margin-top: 2px;
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: 44% 56%;
    gap: 10px;
  }

  .summary-card,
  .heatmap-card {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .summary-head,
  .heatmap-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  .section-meta {
    font-size: 12px;
    color: #94a3b8;
  }

  .summary-shell,
  .heatmap-shell {
    position: relative;
    flex: 1;
    min-height: 0;
    border: 1px solid #eef2f7;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }

  .chart-view {
    width: 100%;
    height: 100%;
  }

  .chart-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: #334155;
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(1px);

    &.muted {
      color: #94a3b8;
      background: rgba(248, 250, 252, 0.85);
    }
  }
}
</style>
