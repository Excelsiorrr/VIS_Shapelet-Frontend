<template>
  <div class="margin-content">
    <div class="info-line">
      <div class="one-line">
        <div class="info-title">Low-Margin Sample Count:</div>
        <div class="info-value">{{ total }}</div>
      </div>
      <div class="one-line">
        <div class="info-title">Sample ID:</div>
        <div class="sample-selector">
          <el-select
            v-model="selectedSampleId"
            filterable
            style="width: 220px"
            placeholder="Search sample"
            @change="drawSample"
          >
            <el-option
              v-for="item in samples"
              :key="item.sample_id"
              :label="`Sample ${item.sample_id} (margin: ${item.margin.toFixed(
                3
              )})`"
              :value="item.sample_id"
            />
          </el-select>
        </div>
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
    <div class="status-line" v-if="isLoading">Refreshing low-margin samples...</div>

    <div ref="chartRef" style="width: calc(100% - 40px); height: 280px"></div>
  </div>
</template>
<script setup>
import axios from "@/scripts/axios.js";
import * as echarts from "echarts";
import { ref, defineProps, watch, nextTick, onBeforeUnmount } from "vue";
const props = defineProps({
  datasetName: {
    type: String,
  },
  threshold: {
    type: Number,
  },
  offset: {
    type: Number,
  },
  limit: {
    type: Number,
  },
});
const total = ref();
const samples = ref([]);
const selectedSampleId = ref(null);
const chartRef = ref();
const isLoading = ref(false);
const errorMessage = ref("");
let fetchToken = 0;
let debounceTimer = null;
const getLowMarginSamples = async () => {
  if (!props.datasetName) {
    total.value = 0;
    samples.value = [];
    selectedSampleId.value = null;
    return;
  }
  const currentToken = ++fetchToken;
  const url =
    "v1/part-a/datasets/" + props.datasetName + "/samples/low-margin";
  isLoading.value = true;
  errorMessage.value = "";
  try {
    let response = await axios({
      method: "get",
      url,
      params: {
        threshold: props.threshold,
        offset: props.offset,
        limit: props.limit,
      },
    });
    if (currentToken !== fetchToken) return;
    total.value = response.data.total;
    samples.value = response.data.items;
    const nextSelectedId =
      samples.value.find((item) => item.sample_id === selectedSampleId.value)
        ?.sample_id ?? samples.value[0]?.sample_id ?? null;
    selectedSampleId.value = nextSelectedId;
    if (nextSelectedId !== null) {
      await nextTick();
      drawSample();
    }
  } catch (error) {
    if (currentToken !== fetchToken) return;
    console.log("error", error);
    errorMessage.value = "Failed to refresh low-margin samples.";
  } finally {
    if (currentToken === fetchToken) {
      isLoading.value = false;
    }
  }
};
const drawSample = () => {
  if (!chartRef.value) return;
  const chart = echarts.init(chartRef.value);
  const sample = samples.value.find(
    (s) => s.sample_id === selectedSampleId.value
  );

  if (!sample) return;

  const sequence = sample.sequence.map((d) => d[0]);

  const option = {
    grid: { left: 10, right: 10, top: 20, bottom: 20 },
    title: {
      text: `Sample ${sample.sample_id}`,
      subtext: `label=${sample.label}  pred=${
        sample.pred_class
      }  margin=${sample.margin.toFixed(3)}`,
    },

    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const p = params[0];
        return `t=${p.axisValue}<br/>value=${p.value.toFixed(3)}`;
      },
    },

    xAxis: {
      type: "category",
      data: sequence.map((_, i) => i),
    },

    yAxis: {
      type: "value",
      scale: true,
    },

    series: [
      {
        name: "sequence",
        type: "line",
        data: sequence,
        showSymbol: false,
        smooth: false,
      },
    ],
  };

  chart.setOption(option);
};
watch(
  () => [props.datasetName, props.threshold, props.offset, props.limit],
  () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    selectedSampleId.value = null;
    debounceTimer = setTimeout(() => {
      getLowMarginSamples();
    }, 250);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  fetchToken += 1;
});
</script>

<style lang="scss" scoped>
.margin-content {
  flex: 1;
  .error-alert {
    margin-top: 8px;
  }
  .status-line {
    margin-top: 8px;
    font-size: 13px;
    color: #666;
  }
  .info-line {
    display: flex;
    justify-content: space-between;
  }
  .one-line {
    display: flex;
    gap: 10px;
    align-items: center;
    .info-title {
      font-size: 16px;
    }
    .info-value {
      font-size: 16px;
    }
  }
}
</style>
