<template>
  <el-card class="matrix-card" shadow="never">
    <div class="panel-header">
      <div class="title">I-Value Overview</div>
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
      <div class="heatmap-card">
        <div class="heatmap-head">
          <div class="section-title">Sorted Heatmap</div>
          <div class="section-meta">{{ matrixMetaText }}</div>
        </div>
        <div class="dist-strip-shell">
          <div ref="distChartRef" class="dist-strip-view"></div>
          <div v-if="distLoading" class="chart-overlay">Loading I distribution...</div>
          <div v-else-if="!hasHistogramData" class="chart-overlay muted">No I distribution.</div>
        </div>
        <div class="heatmap-shell">
          <div ref="heatmapChartRef" class="chart-view"></div>
          <div v-if="loading" class="chart-overlay">Loading matrix...</div>
          <div v-else-if="!hasMatrixData" class="chart-overlay muted">No matrix data.</div>
        </div>
      </div>

      <div class="detail-card">
        <div class="detail-head">
          <div class="section-title">Raw Sequence + Activation Overlay</div>
          <div class="section-meta">{{ detailMetaText }}</div>
        </div>

        <div class="detail-body">
          <div class="detail-chart-panel">
            <div class="detail-chart-shell">
              <div ref="detailChartRef" class="chart-view"></div>
              <div v-if="!selectedCell" class="chart-overlay muted">
                Select a heatmap cell to compare all member samples on one raw+activation chart.
              </div>
              <div v-else-if="detailLoading" class="chart-overlay">Loading cell detail...</div>
              <div v-else-if="!hasCellDetail" class="chart-overlay muted">
                No cell detail available.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";
import axios from "@/scripts/axios.js";

const DEFAULT_TIME_BINS = 180;
const DEFAULT_ROW_BINS = 120;
const DEFAULT_AGGREGATION = "max";
const DEFAULT_NORMALIZATION = "none";
const DEFAULT_SORT_MODE = "peak_position";

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

const heatmapChartRef = ref(null);
const detailChartRef = ref(null);
const distChartRef = ref(null);
let heatmapChart = null;
let detailChart = null;
let distChart = null;

const loading = ref(false);
const detailLoading = ref(false);
const distLoading = ref(false);
const errorMessage = ref("");
const matrixData = ref(null);
const cellDetail = ref(null);
const histogramData = ref(null);
const lastUpdated = ref(null);
const selectedCell = ref(null);

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
const hasCellDetail = computed(() => {
  const data = cellDetail.value;
  return !!(
    data &&
    Array.isArray(data.members) &&
    data.members.length &&
    Array.isArray(data.sequence_median) &&
    data.sequence_median.length
  );
});
const hasHistogramData = computed(() => {
  const data = histogramData.value;
  return !!(
    data &&
    Array.isArray(data.counts) &&
    data.counts.length &&
    Array.isArray(data.bin_edges) &&
    data.bin_edges.length >= 2
  );
});
const matrixMetaText = computed(() => {
  const data = matrixData.value;
  if (!data) return "";
  return `rows=${data.row_bins}  time-bins=${data.time_bins}  sort=${data.sort_mode}  agg=${data.aggregation}`;
});
const histogramStats = computed(() => {
  const data = histogramData.value;
  if (!data || !Array.isArray(data.counts) || !Array.isArray(data.bin_edges) || data.bin_edges.length < 2) {
    return null;
  }

  const edges = data.bin_edges.map((value) => Number(value ?? 0));
  const counts = data.counts.map((value) => Number(value ?? 0));
  const rangeMin = Number(edges[0] ?? 0);
  const rangeMax = Number(edges[edges.length - 1] ?? 1);
  const masses = counts.map((value, index) => {
    const start = Number(edges[index] ?? rangeMin);
    const end = Number(edges[index + 1] ?? start);
    return value * Math.max(end - start, 1e-9);
  });
  const totalMass = masses.reduce((sum, value) => sum + value, 0);

  const approximateQuantile = (q) => {
    if (totalMass <= 0) {
      const safeIndex = Math.min(
        Math.max(Math.round((edges.length - 2) * q), 0),
        Math.max(edges.length - 2, 0)
      );
      return Number(edges[safeIndex] ?? rangeMin);
    }

    const target = totalMass * q;
    let acc = 0;
    for (let i = 0; i < masses.length; i += 1) {
      const start = Number(edges[i] ?? rangeMin);
      const end = Number(edges[i + 1] ?? start);
      const mass = masses[i];
      if (acc + mass >= target) {
        if (mass <= 0) return start;
        const ratio = (target - acc) / mass;
        return start + (end - start) * ratio;
      }
      acc += mass;
    }
    return rangeMax;
  };

  return {
    rangeMin,
    rangeMax,
    p10: approximateQuantile(0.1),
    p25: approximateQuantile(0.25),
    p50: approximateQuantile(0.5),
    p75: approximateQuantile(0.75),
    p90: approximateQuantile(0.9),
  };
});
const detailMetaText = computed(() => {
  if (!selectedCell.value) {
    return "click a heatmap cell to inspect all samples inside that row bucket";
  }
  const status = describeCellStatus(Number(selectedCell.value.cellValue ?? 0), histogramStats.value, Number(props.omega ?? 0));
  return `window ${selectedCell.value.timeStart} - ${selectedCell.value.timeEnd} | cell I ${Number(
    selectedCell.value.cellValue ?? 0
  ).toFixed(3)} | ${status}`;
});
const initCharts = () => {
  if (heatmapChartRef.value && !heatmapChart) {
    heatmapChart = echarts.init(heatmapChartRef.value);
  }
  if (detailChartRef.value && !detailChart) {
    detailChart = echarts.init(detailChartRef.value);
  }
  if (distChartRef.value && !distChart) {
    distChart = echarts.init(distChartRef.value);
  }
};

const disposeCharts = () => {
  if (heatmapChart) {
    heatmapChart.dispose();
    heatmapChart = null;
  }
  if (detailChart) {
    detailChart.dispose();
    detailChart = null;
  }
  if (distChart) {
    distChart.dispose();
    distChart = null;
  }
};

const clearDetailChart = () => {
  if (detailChart) detailChart.clear();
};

const clearDistChart = () => {
  if (distChart) distChart.clear();
};

const buildHeatmapData = (matrix) => {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  const result = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      result.push([x, y, matrix[y][x]]);
    }
  }
  return result;
};

const describeCellStatus = (cellValue, stats, omega) => {
  const value = Number(cellValue ?? 0);
  const threshold = Number(omega ?? 0);
  if (!stats) {
    return value >= threshold ? "triggered" : "below omega";
  }
  if (value >= threshold) return "triggered";
  if (value >= stats.p90) return "strong but not triggered";
  if (value >= stats.p50) return "above typical";
  return "below typical";
};

const renderDetailChart = () => {
  initCharts();
  if (!detailChart) return;
  if (!hasCellDetail.value || !selectedCell.value) {
    detailChart.clear();
    return;
  }

  const detail = cellDetail.value;
  const xValues = detail.sequence_median.map((_, i) => i);
  const activationMedian = detail.activation_median || [];
  const sequenceMedian = detail.sequence_median || [];
  const members = Array.isArray(detail.members) ? detail.members : [];
  const timeStart = Number(selectedCell.value.timeStart ?? 0);
  const timeEnd = Number(selectedCell.value.timeEnd ?? timeStart);
  const windowMarkArea = [
    [
      {
        name: "selected window",
        xAxis: timeStart,
      },
      {
        xAxis: timeEnd,
      },
    ],
  ];
  const windowMarkLine = [
    {
      xAxis: timeStart,
      label: {
        show: true,
        formatter: `start ${timeStart}`,
        color: "#c2410c",
        fontSize: 10,
      },
      lineStyle: {
        color: "rgba(249, 115, 22, 0.95)",
        width: 1.4,
        type: "dashed",
      },
    },
    {
      xAxis: timeEnd,
      label: {
        show: true,
        formatter: `end ${timeEnd}`,
        color: "#c2410c",
        fontSize: 10,
      },
      lineStyle: {
        color: "rgba(249, 115, 22, 0.95)",
        width: 1.4,
        type: "dashed",
      },
    },
  ];

  const rawSeries = members.map((member) => ({
    type: "line",
    yAxisIndex: 0,
    data: member.sequence_curve || [],
    smooth: false,
    symbol: "none",
    sampling: "lttb",
    lineStyle: {
      color: "rgba(15, 23, 42, 0.10)",
      width: 1,
    },
    emphasis: {
      disabled: true,
    },
    silent: true,
    z: 1,
  }));

  const activationSeries = members.map((member) => ({
    type: "line",
    yAxisIndex: 1,
    data: member.activation_curve || [],
    smooth: true,
    symbol: "none",
    sampling: "lttb",
    lineStyle: {
      color: "rgba(249, 115, 22, 0.12)",
      width: 1,
    },
    emphasis: {
      disabled: true,
    },
    silent: true,
    z: 2,
  }));

  detailChart.setOption(
    {
      animation: false,
      grid: {
        left: 46,
        right: 48,
        top: 30,
        bottom: 28,
      },
      tooltip: {
        trigger: "axis",
      },
      legend: {
        top: 0,
        right: 8,
        itemWidth: 12,
        itemHeight: 6,
        textStyle: {
          color: "#64748b",
          fontSize: 11,
        },
        data: ["median raw", "median activation"],
      },
      xAxis: {
        type: "category",
        data: xValues,
        axisLabel: {
          color: "#64748b",
          fontSize: 10,
          interval: Math.max(0, Math.floor(xValues.length / 6)),
        },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: [
        {
          type: "value",
          name: "raw",
          nameTextStyle: {
            color: "#0f172a",
            fontSize: 11,
          },
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
          },
          splitLine: { lineStyle: { color: "#eef2f7" } },
        },
        {
          type: "value",
          name: "activation",
          nameTextStyle: {
            color: "#f97316",
            fontSize: 11,
          },
          axisLabel: {
            color: "#94a3b8",
            fontSize: 10,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        ...rawSeries,
        ...activationSeries,
        {
          name: "median raw",
          type: "line",
          yAxisIndex: 0,
          data: sequenceMedian,
          smooth: false,
          symbol: "none",
          lineStyle: {
            color: "#0f172a",
            width: 2.1,
          },
          markArea: {
            silent: true,
            itemStyle: {
              color: "rgba(249, 115, 22, 0.22)",
            },
            data: windowMarkArea,
          },
          markLine: {
            symbol: "none",
            silent: true,
            data: windowMarkLine,
          },
          z: 4,
        },
        {
          name: "median activation",
          type: "line",
          yAxisIndex: 1,
          data: activationMedian,
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: "#f97316",
            width: 2.3,
          },
          z: 5,
        },
      ],
    },
    true
  );
};

const renderDistChart = () => {
  initCharts();
  if (!distChart) return;
  if (!hasHistogramData.value) {
    distChart.clear();
    return;
  }

  const data = histogramData.value;
  const stats = histogramStats.value;
  if (!stats) {
    distChart.clear();
    return;
  }
  const omega = Number(props.omega ?? 0);
  const safeOmega = Math.min(Math.max(omega, stats.rangeMin), stats.rangeMax);

  distChart.setOption(
    {
      animation: false,
      grid: {
        left: 28,
        right: 18,
        top: 8,
        bottom: 18,
      },
      tooltip: {
        trigger: "item",
        formatter: () =>
          [
            `range: ${stats.rangeMin.toFixed(4)} - ${stats.rangeMax.toFixed(4)}`,
            `median: ${stats.p50.toFixed(4)}`,
            `P25: ${stats.p25.toFixed(4)}`,
            `P90: ${stats.p90.toFixed(4)}`,
            `omega: ${omega.toFixed(4)}`,
          ].join("<br/>"),
      },
      xAxis: {
        type: "value",
        min: stats.rangeMin,
        max: stats.rangeMax,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 10,
          formatter: (value) => Number(value).toFixed(2),
        },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: "#d7deea" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        show: false,
        min: 0,
        max: 1,
      },
      series: [
        {
          type: "custom",
          data: [[stats.rangeMin, stats.rangeMax]],
          renderItem(params, api) {
            const start = api.coord([api.value(0), 0.5]);
            const end = api.coord([api.value(1), 0.5]);
            const height = 12;
            return {
              type: "group",
              children: [
                {
                  type: "rect",
                  shape: {
                    x: start[0],
                    y: start[1] - height / 2,
                    width: Math.max(end[0] - start[0], 2),
                    height,
                    r: 7,
                  },
                  style: {
                    fill: "rgba(52, 126, 235, 0.10)",
                    stroke: "rgba(52, 126, 235, 0.24)",
                    lineWidth: 1,
                  },
                },
                {
                  type: "rect",
                  shape: {
                    x: api.coord([stats.p10, 0.5])[0],
                    y: start[1] - 6,
                    width: Math.max(api.coord([stats.p90, 0.5])[0] - api.coord([stats.p10, 0.5])[0], 2),
                    height: 12,
                    r: 6,
                  },
                  style: {
                    fill: "rgba(37, 99, 235, 0.10)",
                  },
                },
                {
                  type: "rect",
                  shape: {
                    x: api.coord([stats.p25, 0.5])[0],
                    y: start[1] - 5,
                    width: Math.max(api.coord([stats.p75, 0.5])[0] - api.coord([stats.p25, 0.5])[0], 2),
                    height: 10,
                    r: 5,
                  },
                  style: {
                    fill: "rgba(37, 99, 235, 0.16)",
                  },
                },
                {
                  type: "line",
                  shape: {
                    x1: api.coord([stats.p50, 0.5])[0],
                    y1: start[1] - 10,
                    x2: api.coord([stats.p50, 0.5])[0],
                    y2: start[1] + 10,
                  },
                  style: {
                    stroke: "#2563eb",
                    lineWidth: 1.4,
                  },
                },
                {
                  type: "line",
                  shape: {
                    x1: api.coord([stats.p90, 0.5])[0],
                    y1: start[1] - 10,
                    x2: api.coord([stats.p90, 0.5])[0],
                    y2: start[1] + 10,
                  },
                  style: {
                    stroke: "#7c3aed",
                    lineWidth: 1.2,
                  },
                },
              ],
            };
          },
          z: 1,
          silent: true,
        },
        {
          type: "line",
          data: [
            [safeOmega, 0],
            [safeOmega, 1],
          ],
          symbol: "none",
          lineStyle: {
            color: "#f97316",
            width: 1.5,
            type: "dashed",
          },
          label: {
            show: true,
            position: "end",
            formatter: `ω ${omega.toFixed(3)}`,
            color: "#c2410c",
            fontSize: 10,
          },
          z: 4,
          silent: true,
        },
      ],
      graphic: [
        {
          type: "text",
          left: 30,
          top: 2,
          style: {
            text: `median ${stats.p50.toFixed(3)}   P90 ${stats.p90.toFixed(3)}`,
            fill: "#64748b",
            font: "11px sans-serif",
          },
          silent: true,
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
  const heatmapData = buildHeatmapData(data.matrix);

  heatmapChart.off("click");
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
          const cellValue = Number(v ?? 0);
          const stats = histogramStats.value;
          const status = describeCellStatus(cellValue, stats, Number(props.omega ?? 0));
          if (!stats) {
            return `time-bin: ${x}<br/>row: ${y}<br/>cell I: ${cellValue.toFixed(4)}<br/>status: ${status}`;
          }
          return [
            `time-bin: ${x}`,
            `row: ${y}`,
            `cell I: ${cellValue.toFixed(4)}`,
            `median: ${stats.p50.toFixed(4)}`,
            `P90: ${stats.p90.toFixed(4)}`,
            `omega: ${Number(props.omega ?? 0).toFixed(4)}`,
            `status: ${status}`,
          ].join("<br/>");
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
        axisLabel: { show: false },
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
        itemHeight: 220,
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
              borderWidth: 0.8,
            },
          },
        },
      ],
    },
    true
  );

  heatmapChart.on("click", async (params) => {
    const [timeBinIndex, rowIndex, cellValue] = params.data || [];
    const start = Number(data.time_edges?.[timeBinIndex] ?? 0);
    const endRaw = Number(data.time_edges?.[timeBinIndex + 1] ?? start + 1);
    selectedCell.value = {
      rowIndex,
      rowSize: Number(data.row_sizes?.[rowIndex] ?? 0),
      timeBinIndex,
      timeStart: start,
      timeEnd: Math.max(start, endRaw - 1),
      cellValue: Number(cellValue ?? 0),
      exceedRatio: Number(data.exceed_ratio?.[timeBinIndex] ?? 0),
    };
    await fetchCellDetail();
  });
};

const fetchCellDetail = async () => {
  if (!props.datasetName || !props.shapeletId || !selectedCell.value) {
    cellDetail.value = null;
    return;
  }

  detailLoading.value = true;
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/stats/matrix-cell-detail`,
      params: {
        row_index: selectedCell.value.rowIndex,
        time_bin_index: selectedCell.value.timeBinIndex,
        scope: props.scope || "test",
        omega: props.omega,
        time_bins: DEFAULT_TIME_BINS,
        row_bins: DEFAULT_ROW_BINS,
        aggregation: DEFAULT_AGGREGATION,
        normalization: DEFAULT_NORMALIZATION,
        sort_mode: DEFAULT_SORT_MODE,
      },
    });
    cellDetail.value = response.data || null;
    await nextTick();
    renderDetailChart();
  } catch (error) {
    console.log("error", error);
    cellDetail.value = null;
    clearDetailChart();
  } finally {
    detailLoading.value = false;
  }
};

const fetchHistogram = async () => {
  if (!props.datasetName || !props.shapeletId) {
    histogramData.value = null;
    clearDistChart();
    return;
  }

  distLoading.value = true;
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/stats/histogram`,
      params: {
        scope: props.scope || "test",
        hist_mode: "per_shapelet",
        shapelet_id: props.shapeletId,
        bins: 48,
        density: true,
      },
    });
    histogramData.value = response.data || null;
    await nextTick();
    renderDistChart();
  } catch (error) {
    console.log("error", error);
    histogramData.value = null;
    clearDistChart();
  } finally {
    distLoading.value = false;
  }
};

const fetchMatrixSummary = async () => {
  if (!props.datasetName || !props.shapeletId) {
    matrixData.value = null;
    histogramData.value = null;
    errorMessage.value = "";
    lastUpdated.value = null;
    selectedCell.value = null;
    cellDetail.value = null;
    clearDetailChart();
    clearDistChart();
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  selectedCell.value = null;
  cellDetail.value = null;
  clearDetailChart();
  try {
    const [matrixResponse] = await Promise.all([
      axios({
        method: "get",
        url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/stats/matrix-summary`,
        params: {
          scope: props.scope || "test",
          omega: props.omega,
          time_bins: DEFAULT_TIME_BINS,
          row_bins: DEFAULT_ROW_BINS,
          aggregation: DEFAULT_AGGREGATION,
          normalization: DEFAULT_NORMALIZATION,
          sort_mode: DEFAULT_SORT_MODE,
        },
      }),
      fetchHistogram(),
    ]);
    matrixData.value = matrixResponse.data || null;
    lastUpdated.value = Date.now();
    await nextTick();
    renderHeatmapChart();
  } catch (error) {
    console.log("error", error);
    errorMessage.value = "Failed to load I-value overview.";
    matrixData.value = null;
    renderHeatmapChart();
    clearDetailChart();
  } finally {
    loading.value = false;
  }
};

const onWindowResize = () => {
  if (heatmapChart) heatmapChart.resize();
  if (detailChart) detailChart.resize();
  if (distChart) {
    distChart.resize();
    renderDistChart();
  }
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
    grid-template-rows: 54% 46%;
    gap: 10px;
  }

  .heatmap-card,
  .detail-card {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .heatmap-head,
  .detail-head {
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

  .heatmap-shell,
  .dist-strip-shell,
  .detail-chart-shell {
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

  .dist-strip-shell {
    flex: 0 0 54px;
    min-height: 54px;
    border-style: dashed;
    background: linear-gradient(180deg, #fbfdff 0%, #f8fbff 100%);
  }

  .dist-strip-view {
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

  .detail-empty {
    flex: 1;
    min-height: 0;
    border: 1px dashed #dbe3ee;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 13px;
    background: #fbfcfe;
  }

  .detail-body {
    flex: 1;
    min-height: 0;
    display: block;
  }

  .detail-chart-panel {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .detail-chart-shell {
    min-height: 280px;
  }

  @media (max-width: 1200px) {
    .panel-body {
      grid-template-rows: 50% 50%;
    }

    .detail-body {
      display: block;
    }

    .detail-chart-shell {
      min-height: 240px;
    }
  }
}
</style>
