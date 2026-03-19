<template>
  <div class="samples-content">
    <div class="header-line">
      <div class="title">Test Samples Clustered By Predicted Class</div>
      <div class="meta">
        <span>Total Samples: {{ allSummaries.length }}</span>
        <span v-if="activeClusterKey">Loaded In Cluster: {{ activeClusterLoadedCount }}</span>
        <el-button
          type="primary"
          plain
          size="small"
          :disabled="!datasetName || summaryLoading"
          @click="loadAllSummaries"
        >
          Reload
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="warning"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <el-skeleton :rows="6" animated v-if="summaryLoading" />

    <div v-else-if="clusterKeys.length" class="cluster-body">
      <el-tabs v-model="activeClusterKey" class="cluster-tabs">
        <el-tab-pane
          v-for="clusterKey in clusterKeys"
          :key="clusterKey"
          :name="String(clusterKey)"
          :label="`Pred Class ${clusterKey} (${clusterMap[clusterKey].samples.length})`"
        />
      </el-tabs>

      <div class="cluster-loading" v-if="clusterLoading">Loading all sequences in this cluster...</div>



      <div class="content-line">
        <div ref="chartRef" class="cluster-chart"></div>

        <div class="sample-list">
          <div class="list-title">Samples In This Cluster</div>
          <el-table
            :data="activeClusterSamples"
            :current-row-key="selectedSampleId || undefined"
            height="320"
            row-key="sample_id"
            highlight-current-row
            @current-change="onCurrentRowChange"
          >
            <el-table-column prop="sample_id" label="Sample" min-width="95" />
            <el-table-column prop="label" label="True" width="65" />
            <el-table-column label="Margin" width="88">
              <template #default="{ row }">
                {{ toFixedSafe(row.prediction?.margin) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div class="detail-line" v-if="selectedSample">
        <span>Selected: {{ selectedSample.sample_id }}</span>
        <span>True Label: {{ selectedSample.label }}</span>
        <span>Pred Class: {{ selectedSample.prediction?.pred_class }}</span>
        <span>Margin: {{ toFixedSafe(selectedSample.prediction?.margin) }}</span>
      </div>
    </div>

    <div v-else class="empty-state">No sample data loaded for current dataset.</div>
  </div>
</template>

<script setup>
import axios from "@/scripts/axios.js";
import * as echarts from "echarts";
import { computed, defineProps, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  datasetName: {
    type: String,
    default: "",
  },
  classDistribution: {
    type: Object,
    default: () => ({}),
  },
});

const summaryLoading = ref(false);
const clusterLoading = ref(false);
const errorMessage = ref("");
const allSummaries = ref([]);
const clusterMap = ref({});
const clusterDetailCache = ref({});
const activeClusterKey = ref("");
const selectedSampleId = ref("");

const chartRef = ref(null);
let chartInstance = null;
let summaryLoadToken = 0;

const classLabels = computed(() => {
  const labels = Object.keys(props.classDistribution || {}).map((v) => Number(v));
  return labels.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
});

const clusterKeys = computed(() => {
  return Object.keys(clusterMap.value)
    .map((v) => Number(v))
    .sort((a, b) => a - b);
});

const activeClusterSamples = computed(() => {
  const key = Number(activeClusterKey.value);
  if (Number.isNaN(key) || !clusterMap.value[key]) return [];
  return clusterMap.value[key].samples;
});

const selectedSample = computed(() => {
  if (!selectedSampleId.value) return null;
  return activeClusterSamples.value.find((s) => s.sample_id === selectedSampleId.value) || null;
});

const activeClusterLoadedCount = computed(() => {
  const key = Number(activeClusterKey.value);
  if (Number.isNaN(key)) return 0;
  const cache = clusterDetailCache.value[key];
  if (!cache?.detailsById) return 0;
  return Object.keys(cache.detailsById).length;
});

const toFixedSafe = (num) => {
  if (typeof num !== "number") return "N/A";
  return num.toFixed(3);
};

const normalizeSequence = (sequence) => {
  return (sequence || []).map((point) => (Array.isArray(point) ? point[0] : point));
};

const getClassSamplesOnePage = async (label, offset, limit) => {
  const url = `v1/part-a/datasets/${props.datasetName}/samples`;
  const response = await axios({
    method: "get",
    url,
    params: { label, offset, limit },
  });
  return response.data;
};

const getSampleDetail = async (sampleId) => {
  const url = `v1/part-a/datasets/${props.datasetName}/samples/${sampleId}`;
  const response = await axios({
    method: "get",
    url,
    params: { split: "test" },
  });
  return response.data;
};

const mapWithConcurrency = async (arr, concurrency, mapper) => {
  const results = new Array(arr.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < arr.length) {
      const i = cursor;
      cursor += 1;
      try {
        results[i] = await mapper(arr[i], i);
      } catch (error) {
        results[i] = null;
      }
    }
  };
  const count = Math.min(concurrency, arr.length);
  await Promise.all(new Array(count).fill(0).map(() => worker()));
  return results.filter(Boolean);
};

const getAllSampleSummaries = async (token) => {
  const pageLimit = 200;
  const allItems = [];
  for (const label of classLabels.value) {
    let offset = 0;
    let total = 0;
    do {
      if (token !== summaryLoadToken) return [];
      const page = await getClassSamplesOnePage(label, offset, pageLimit);
      const items = page.items || [];
      total = page.total || 0;
      allItems.push(...items);
      offset += pageLimit;
    } while (offset < total);
  }
  return allItems;
};

const buildClusterMapFromSummaries = (summaries) => {
  const grouped = {};
  summaries.forEach((item) => {
    const predClass = item?.prediction?.pred_class;
    if (predClass === undefined || predClass === null) return;
    if (!grouped[predClass]) grouped[predClass] = { samples: [] };
    grouped[predClass].samples.push(item);
  });
  return grouped;
};

const ensureChart = () => {
  if (!chartRef.value) return;
  if (chartInstance) return;
  chartInstance = echarts.init(chartRef.value);
  chartInstance.on("click", async (params) => {
    const seriesId = params?.seriesId || "";
    if (!seriesId.startsWith("bg-")) return;
    const sampleId = seriesId.replace("bg-", "");
    if (!sampleId) return;
    await selectSample(sampleId);
  });
};

const renderEmptyChart = () => {
  ensureChart();
  if (!chartInstance) return;
  chartInstance.clear();
};

const renderBackgroundForCluster = (clusterKey) => {
  ensureChart();
  if (!chartInstance) return;
  const cache = clusterDetailCache.value[clusterKey];
  if (!cache?.loaded) return;
  const details = Object.values(cache.detailsById || {});
  if (!details.length) {
    renderEmptyChart();
    return;
  }

  const xLen = normalizeSequence(details[0].sequence).length;
  const backgroundSeries = details.map((detail) => ({
    id: `bg-${detail.sample_id}`,
    name: `Sample ${detail.sample_id}`,
    type: "line",
    data: normalizeSequence(detail.sequence),
    showSymbol: false,
    smooth: false,
    lineStyle: {
      width: 1,
      opacity: 0.14,
      color: "#2563eb",
    },
    emphasis: {
      lineStyle: {
        width: 1.8,
        opacity: 0.7,
        color: "#1d4ed8",
      },
    },
    z: 1,
  }));

  const selectedOverlay = {
    id: "selected-overlay",
    name: "Selected",
    type: "line",
    data: [],
    showSymbol: false,
    smooth: false,
    lineStyle: {
      width: 2.6,
      color: "#ef4444",
      opacity: 1,
    },
    z: 10,
  };

  chartInstance.setOption(
    {
      animation: false,
      grid: { left: 40, right: 20, top: 30, bottom: 30 },
      tooltip: {
        trigger: "item",
        formatter: (params) => {
          if (typeof params.value !== "number") return `${params.seriesName}`;
          return `${params.seriesName}<br/>t=${params.dataIndex}<br/>value=${toFixedSafe(params.value)}`;
        },
      },
      xAxis: {
        type: "category",
        data: Array.from({ length: xLen }, (_, i) => i),
        name: "Time",
      },
      yAxis: {
        type: "value",
        name: "Value",
        scale: true,
      },
      series: [...backgroundSeries, selectedOverlay],
    },
    true
  );
};

const updateSelectedOverlay = (detail) => {
  ensureChart();
  if (!chartInstance) return;
  if (!detail?.sequence?.length) {
    chartInstance.setOption({
      series: [
        {
          id: "selected-overlay",
          data: [],
        },
      ],
    });
    return;
  }
  chartInstance.setOption({
    series: [
      {
        id: "selected-overlay",
        name: `Selected ${detail.sample_id}`,
        data: normalizeSequence(detail.sequence),
      },
    ],
  });
};

const ensureClusterDetailsLoaded = async (clusterKey) => {
  const key = Number(clusterKey);
  if (Number.isNaN(key) || !clusterMap.value[key]) return;

  const existing = clusterDetailCache.value[key];
  if (existing?.loaded) return;
  if (existing?.loadingPromise) {
    await existing.loadingPromise;
    return;
  }

  const sampleIds = clusterMap.value[key].samples.map((s) => s.sample_id).filter(Boolean);
  if (!sampleIds.length) {
    clusterDetailCache.value[key] = { loaded: true, detailsById: {} };
    return;
  }

  const loadingPromise = (async () => {
    const details = await mapWithConcurrency(sampleIds, 8, async (sampleId) => getSampleDetail(sampleId));
    const detailsById = {};
    details.forEach((detail) => {
      if (!detail?.sample_id) return;
      detailsById[detail.sample_id] = detail;
    });
    clusterDetailCache.value[key] = {
      loaded: true,
      detailsById,
      loadingPromise: null,
    };
  })();

  clusterDetailCache.value[key] = {
    loaded: false,
    detailsById: existing?.detailsById || {},
    loadingPromise,
  };

  await loadingPromise;
};

const selectSample = async (sampleId) => {
  if (!sampleId || !props.datasetName) return;
  selectedSampleId.value = sampleId;
  try {
    const detail = await getSampleDetail(sampleId);

    const key = Number(activeClusterKey.value);
    if (!Number.isNaN(key)) {
      if (!clusterDetailCache.value[key]) {
        clusterDetailCache.value[key] = { loaded: false, detailsById: {} };
      }
      clusterDetailCache.value[key].detailsById = clusterDetailCache.value[key].detailsById || {};
      clusterDetailCache.value[key].detailsById[sampleId] = detail;
    }
    updateSelectedOverlay(detail);
  } catch (error) {
    console.log("error", error);
  }
};

const onCurrentRowChange = async (row) => {
  if (!row?.sample_id) return;
  await selectSample(row.sample_id);
};

const loadAllSummaries = async () => {
  if (!props.datasetName || !classLabels.value.length) {
    allSummaries.value = [];
    clusterMap.value = {};
    clusterDetailCache.value = {};
    activeClusterKey.value = "";
    selectedSampleId.value = "";
    renderEmptyChart();
    return;
  }
  const token = summaryLoadToken + 1;
  summaryLoadToken = token;
  summaryLoading.value = true;
  clusterLoading.value = false;
  errorMessage.value = "";
  try {
    const summaries = await getAllSampleSummaries(token);
    if (token !== summaryLoadToken) return;

    const idSet = new Set();
    allSummaries.value = summaries.filter((s) => {
      const id = s?.sample_id;
      if (!id || idSet.has(id)) return false;
      idSet.add(id);
      return true;
    });

    clusterMap.value = buildClusterMapFromSummaries(allSummaries.value);
    clusterDetailCache.value = {};
    selectedSampleId.value = "";
    const keys = Object.keys(clusterMap.value).map((v) => Number(v)).sort((a, b) => a - b);
    activeClusterKey.value = keys.length ? String(keys[0]) : "";
    await nextTick();
    if (!keys.length) renderEmptyChart();
  } catch (error) {
    console.log("error", error);
    errorMessage.value = "Failed to load test-set sample summaries.";
  } finally {
    if (token === summaryLoadToken) summaryLoading.value = false;
  }
};

const loadAndRenderActiveCluster = async () => {
  const key = Number(activeClusterKey.value);
  if (Number.isNaN(key)) {
    renderEmptyChart();
    return;
  }
  clusterLoading.value = true;
  try {
    await ensureClusterDetailsLoaded(key);
    renderBackgroundForCluster(key);
    updateSelectedOverlay(null);
  } catch (error) {
    console.log("error", error);
    errorMessage.value = "Failed to load full sequences for the selected cluster.";
  } finally {
    clusterLoading.value = false;
  }
};

watch(
  () => [props.datasetName, classLabels.value.join(",")],
  () => {
    loadAllSummaries();
  },
  { immediate: true }
);

watch(
  () => activeClusterKey.value,
  async () => {
    selectedSampleId.value = "";
    await nextTick();
    await loadAndRenderActiveCluster();
  }
);

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
});
</script>

<style scoped lang="scss">
.samples-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: 16px;

  .header-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 34px;
    .title {
      font-size: 16px;
      font-weight: 600;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: #555;
    }
  }

  .error-alert {
    margin-top: 8px;
  }

  .cluster-body {
    margin-top: 10px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .cluster-loading {
    margin-bottom: 8px;
    font-size: 13px;
    color: #666;
  }

  .content-line {
    display: flex;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  .cluster-chart {
    flex: 1;
    min-width: 0;
    height: 360px;
    border: 1px solid #ececec;
    border-radius: 6px;
  }

  .sample-list {
    width: 280px;
    border: 1px solid #ececec;
    border-radius: 6px;
    padding: 8px;
    .list-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }
  }

  .detail-line {
    margin-top: 8px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 13px;
    color: #444;
  }

  .empty-state {
    margin-top: 10px;
    font-size: 13px;
    color: #888;
  }
}
</style>
