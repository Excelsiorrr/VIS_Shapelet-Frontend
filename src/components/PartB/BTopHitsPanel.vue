<template>
  <div class="top-hits-card">
    <div class="head">
      <div>
        <div class="title">Top Hits</div>
        <div class="subtitle">
          strongest triggered samples for class {{ classId }}
        </div>
      </div>
      <div class="meta">
        <span>{{ shapeletId }}</span>
        <span>{{ scope }}</span>
        <span>omega {{ Number(omega ?? 0).toFixed(2) }}</span>
      </div>
    </div>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="warning"
      show-icon
      :closable="false"
    />

    <el-table
      v-else
      v-loading="loading"
      :data="rows"
      stripe
      height="220"
      class="hits-table"
    >
      <el-table-column prop="rank" label="#" width="60" />
      <el-table-column prop="sample_id" label="Sample" min-width="90" />
      <el-table-column label="Trigger" min-width="100">
        <template #default="{ row }">{{ Number(row.trigger_score).toFixed(3) }}</template>
      </el-table-column>
      <el-table-column label="Peak T" min-width="90">
        <template #default="{ row }">{{ row.peak_t }}</template>
      </el-table-column>
      <el-table-column label="Window" min-width="120">
        <template #default="{ row }">{{ row.t_start }}-{{ row.t_end }}</template>
      </el-table-column>
      <el-table-column label="Pred" min-width="80">
        <template #default="{ row }">{{ row.pred_class ?? "-" }}</template>
      </el-table-column>
      <el-table-column label="Margin" min-width="90">
        <template #default="{ row }">{{ row.margin === null || row.margin === undefined ? "-" : Number(row.margin).toFixed(3) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import axios from "@/scripts/axios.js";

const props = defineProps({
  datasetName: { type: String, default: "" },
  shapeletId: { type: String, default: "" },
  scope: { type: String, default: "test" },
  omega: { type: Number, default: 0.1 },
  classId: { type: Number, default: null },
  visible: { type: Boolean, default: false },
});

const loading = ref(false);
const errorMessage = ref("");
const rows = ref([]);

const extractErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (detail && typeof detail.message === "string" && detail.message.trim()) {
    return detail.message;
  }
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === "string" && first.trim()) return first;
    if (first && typeof first.msg === "string" && first.msg.trim()) return first.msg;
    if (first && typeof first.message === "string" && first.message.trim()) return first.message;
  }
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const fetchTopHits = async () => {
  if (!props.visible || !props.datasetName || !props.shapeletId || props.classId === null || props.classId === undefined) {
    rows.value = [];
    errorMessage.value = "";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/samples/top-hits`,
      params: {
        scope: props.scope,
        omega: props.omega,
        class_id: props.classId,
        limit: 12,
      },
    });
    rows.value = Array.isArray(response.data?.items) ? response.data.items : [];
  } catch (error) {
    console.log("error", error);
    rows.value = [];
    errorMessage.value = extractErrorMessage(error, "Failed to load top hit samples.");
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.visible, props.datasetName, props.shapeletId, props.scope, props.omega, props.classId],
  () => {
    fetchTopHits();
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.top-hits-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 10px;
  border: 1px solid #dbe6f3;
  border-radius: 999px;
  background: #f8fbff;
  font-size: 12px;
  color: #334155;
}
</style>
