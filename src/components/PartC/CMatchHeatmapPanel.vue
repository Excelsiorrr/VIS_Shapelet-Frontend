<template>
  <div class="heatmap-panel">
    <div class="panel-header">
      <div>
        <div class="panel-title">Match Tensor</div>
        <div class="panel-subtitle">
          shapelet x time heatmap of model-native match score I[p,t]
        </div>
        <div class="panel-context" v-if="activeShapeletId">
          active {{ activeShapeletId }} · peak_t {{ activePeakT ?? "-" }}
        </div>
      </div>
      <div class="panel-actions">
        <div class="info-chip">
          {{ shapeletCount }} shapelets · {{ timeLength }} time steps
        </div>
      </div>
    </div>

    <div ref="chartRef" class="chart-host"></div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts";

const props = defineProps({
  shapeletIds: { type: Array, default: () => [] },
  matrix: { type: Array, default: () => [] },
  peakT: { type: Array, default: () => [] },
  windows: { type: Array, default: () => [] },
  pinnedShapeletId: { type: String, default: "" },
  activeShapeletId: { type: String, default: "" },
  omega: { type: Number, default: 0 },
});

const emit = defineEmits(["hover-shapelet", "pin-shapelet"]);

const chartRef = ref(null);
let chart = null;

const shapeletCount = computed(() => props.shapeletIds.length);
const timeLength = computed(() => (props.matrix[0] || []).length);
const activePeakT = computed(() => {
  if (!props.activeShapeletId) return null;
  const rowIndex = props.shapeletIds.findIndex((item) => String(item) === props.activeShapeletId);
  if (rowIndex < 0) return null;
  return props.peakT[rowIndex] ?? null;
});

const windowsByShapelet = computed(() => {
  const map = new Map();
  (props.windows || []).forEach((item) => {
    map.set(String(item.shapelet_id), item);
  });
  return map;
});

const seriesData = computed(() => {
  const data = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  props.matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const numeric = Number(value || 0);
      min = Math.min(min, numeric);
      max = Math.max(max, numeric);
      const shapeletId = String(props.shapeletIds[rowIndex] || "");
      data.push({
        value: [columnIndex, rowIndex, numeric],
        itemStyle:
          shapeletId && shapeletId === props.pinnedShapeletId
            ? {
                borderColor: "#0e5678",
                borderWidth: 0.35,
              }
            : undefined,
      });
    });
  });
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 1;
  return { data, min, max };
});

const peakScatterData = computed(() =>
  props.shapeletIds
    .map((shapeletId, rowIndex) => {
      const peak = props.peakT[rowIndex];
      if (peak === null || peak === undefined) return null;
      return {
        value: [Number(peak), rowIndex],
        itemStyle: {
          color:
            String(shapeletId) === props.activeShapeletId
              ? "#f08c00"
              : String(shapeletId) === props.pinnedShapeletId
                ? "#1d4ed8"
                : "rgba(15, 23, 42, 0.35)",
        },
        symbolSize:
          String(shapeletId) === props.activeShapeletId
            ? 9
            : String(shapeletId) === props.pinnedShapeletId
              ? 8
              : 5,
      };
    })
    .filter(Boolean)
);

const renderChart = async () => {
  await nextTick();
  if (!chartRef.value) return;
  if (!chart) {
    chart = echarts.init(chartRef.value);
    chart.on("mouseover", (params) => {
      if (!params?.value) return;
      const rowIndex = Number(params.value[1]);
      const shapeletId = String(props.shapeletIds[rowIndex] || "");
      if (shapeletId) emit("hover-shapelet", shapeletId);
    });
    chart.on("globalout", () => {
      emit("hover-shapelet", "");
    });
    chart.on("click", (params) => {
      if (!params?.value) return;
      const rowIndex = Number(params.value[1]);
      const shapeletId = String(props.shapeletIds[rowIndex] || "");
      if (shapeletId) emit("pin-shapelet", shapeletId);
    });
  }

  const option = {
    animation: false,
    grid: {
      left: 72,
      right: 22,
      top: 18,
      bottom: 44,
      containLabel: false,
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(18, 26, 42, 0.92)",
      borderWidth: 0,
      textStyle: { color: "#f5f9ff", fontSize: 12 },
      formatter: (params) => {
        const [t, rowIndex, score] = params.value;
        const shapeletId = String(props.shapeletIds[rowIndex] || "-");
        const peak = props.peakT[rowIndex];
        const window = windowsByShapelet.value.get(shapeletId);
        return [
          `<div><strong>${shapeletId}</strong></div>`,
          `<div>t: ${t}</div>`,
          `<div>I: ${Number(score).toFixed(4)}</div>`,
          `<div>peak_t: ${peak ?? "-"}</div>`,
          `<div>triggered: ${window ? (window.triggered ? "yes" : "no") : "no"}</div>`,
          `<div>omega: ${Number(props.omega || 0).toFixed(3)}</div>`,
        ].join("");
      },
    },
    xAxis: {
      type: "category",
      data: Array.from({ length: timeLength.value }, (_, index) => index),
      axisLabel: {
        color: "#70839c",
        interval: Math.max(Math.floor(timeLength.value / 6), 1),
      },
      axisLine: { lineStyle: { color: "#d9e4ef" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: props.shapeletIds,
      inverse: true,
      axisLabel: {
        color: "#49627a",
        formatter: (value) => {
          return value === props.pinnedShapeletId ? `${value} *` : value;
        },
      },
      axisLine: { lineStyle: { color: "#d9e4ef" } },
      axisTick: { show: false },
    },
    visualMap: {
      min: seriesData.value.min,
      max: seriesData.value.max,
      calculable: false,
      orient: "vertical",
      right: 0,
      top: "middle",
      itemHeight: 160,
      text: ["high", "low"],
      textStyle: { color: "#73859d", fontSize: 11 },
      inRange: {
        color: ["#f3f8ff", "#bcd4ff", "#669ef6", "#2045b8"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: seriesData.value.data,
        progressive: 0,
        emphasis: {
          itemStyle: {
            borderColor: "#12263f",
            borderWidth: 1,
          },
        },
      },
      {
        type: "scatter",
        coordinateSystem: "cartesian2d",
        data: peakScatterData.value,
        tooltip: { show: false },
        z: 4,
      },
    ],
  };
  chart.setOption(option, true);
};

const resizeChart = () => {
  chart?.resize();
};

watch(
  () => [props.shapeletIds, props.matrix, props.pinnedShapeletId, props.activeShapeletId, props.windows, props.omega],
  () => {
    renderChart();
  },
  { deep: true }
);

onMounted(() => {
  renderChart();
  window.addEventListener("resize", resizeChart);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeChart);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped lang="scss">
.heatmap-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
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
  color: #b06a00;
  font-size: 12px;
  font-weight: 700;
}

.panel-actions {
  display: flex;
  align-items: flex-start;
}

.info-chip {
  padding: 8px 12px;
  border: 1px solid #dbe7f3;
  border-radius: 999px;
  background: #fbfdff;
  color: #4f6780;
  font-size: 12px;
  font-weight: 700;
}

.chart-host {
  min-height: 0;
  width: 100%;
  height: 100%;
}
</style>
