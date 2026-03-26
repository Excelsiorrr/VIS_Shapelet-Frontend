<template>
  <el-card class="summary-card" shadow="never">
    <div class="panel-head">
      <div class="title">Summary Stats</div>
      <div class="meta" v-if="summaryData">
        <span>scope={{ summaryData.scope }}</span>
        <span>omega={{ Number(summaryData.omega ?? 0).toFixed(2) }}</span>
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

    <div v-else-if="loading" class="summary-loading">Loading summary stats...</div>

    <div v-else-if="summaryData" class="summary-body">
      <div class="summary-grid">
        <div
          v-for="item in statCards"
          :key="item.label"
          class="stat-item"
        >
          <div class="stat-label">{{ item.label }}</div>
          <div class="stat-value" :class="item.tone">{{ item.value }}</div>
          <div class="stat-note">{{ item.note }}</div>
        </div>
      </div>

      <div v-if="warningMessages.length" class="warning-list">
        <div class="warning-title">Warnings</div>
        <div
          v-for="warning in warningMessages"
          :key="warning"
          class="warning-item"
        >
          {{ warning }}
        </div>
      </div>
    </div>

    <div v-else class="summary-loading muted">No summary data.</div>
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from "vue";
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

const loading = ref(false);
const errorMessage = ref("");
const summaryData = ref(null);

const percentText = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const supportStatus = computed(() => {
  const support = summaryData.value?.support;
  if (!support) {
    return {
      label: "N.A.",
      tone: "neutral",
      note: "support status unavailable",
    };
  }

  const triggered = Number(support.triggered_samples || 0);
  const minSupport = Number(support.min_support || 0);
  if (triggered < minSupport) {
    return {
      label: "Low",
      tone: "danger",
      note: `below min_support=${minSupport}`,
    };
  }

  return {
    label: "Stable",
    tone: "good",
    note: `min_support=${minSupport}`,
  };
});

const warningMessages = computed(() =>
  Array.isArray(summaryData.value?.warnings)
    ? summaryData.value.warnings.map((item) => item.message).filter(Boolean)
    : []
);

const dominantLift = computed(() => {
  const lift = summaryData.value?.lift || {};
  let bestClass = null;
  let bestValue = -Infinity;
  Object.entries(lift).forEach(([classId, value]) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > bestValue) {
      bestClass = classId;
      bestValue = numeric;
    }
  });

  if (bestClass === null) {
    return {
      value: "N.A.",
      note: "lift not stable yet",
      tone: "neutral",
    };
  }

  return {
    value: `Class ${bestClass}`,
    note: `lift=${bestValue.toFixed(2)}`,
    tone: "good",
  };
});

const statCards = computed(() => {
  const support = summaryData.value?.support || {};
  return [
    {
      label: "Global Trigger Rate",
      value: percentText(summaryData.value?.global_trigger_rate),
      note: "samples triggered in current scope",
      tone: "primary",
    },
    {
      label: "Triggered Samples",
      value: `${Number(support.triggered_samples || 0)} / ${Number(support.total_samples || 0)}`,
      note: "support count",
      tone: "neutral",
    },
    {
      label: "Scope",
      value: String(summaryData.value?.scope || props.scope || "test"),
      note: "current statistical range",
      tone: "neutral",
    },
    {
      label: "Omega",
      value: Number(summaryData.value?.omega ?? props.omega ?? 0).toFixed(2),
      note: "current trigger threshold",
      tone: "neutral",
    },
    {
      label: "Support Status",
      value: supportStatus.value.label,
      note: supportStatus.value.note,
      tone: supportStatus.value.tone,
    },
    {
      label: "Best Lift",
      value: dominantLift.value.value,
      note: dominantLift.value.note,
      tone: dominantLift.value.tone,
    },
  ];
});

const fetchSummary = async () => {
  if (!props.datasetName || !props.shapeletId) {
    summaryData.value = null;
    errorMessage.value = "";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/stats/summary`,
      params: {
        scope: props.scope || "test",
        omega: props.omega,
      },
    });
    summaryData.value = response.data || null;
  } catch (error) {
    console.log("error", error);
    summaryData.value = null;
    errorMessage.value = "Failed to load summary stats.";
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.datasetName, props.scope, props.shapeletId, props.omega],
  () => {
    fetchSummary();
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.summary-card {
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

  .panel-head {
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
    gap: 8px;
    color: #64748b;
    font-size: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .state-alert {
    margin-top: 2px;
  }

  .summary-loading {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed #dbe3ee;
    border-radius: 8px;
    color: #64748b;
    font-size: 13px;
    background: #fbfcfe;

    &.muted {
      color: #94a3b8;
    }
  }

  .summary-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: auto auto;
    gap: 10px;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-item {
    border: 1px solid #eef2f7;
    border-radius: 10px;
    background: #fbfdff;
    padding: 12px 12px 10px;
    min-height: 88px;
  }

  .stat-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 20px;
    line-height: 1.15;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 6px;

    &.primary {
      color: #2563eb;
    }

    &.good {
      color: #0f766e;
    }

    &.danger {
      color: #b45309;
    }

    &.neutral {
      color: #0f172a;
    }
  }

  .stat-note {
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.35;
  }

  .warning-list {
    border: 1px solid #f7e3bc;
    border-radius: 8px;
    background: #fffaf0;
    padding: 10px 12px;
  }

  .warning-title {
    font-size: 12px;
    font-weight: 600;
    color: #9a6700;
    margin-bottom: 6px;
  }

  .warning-item {
    font-size: 12px;
    color: #92400e;
    line-height: 1.4;
  }

  @media (max-width: 1200px) {
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
</style>
