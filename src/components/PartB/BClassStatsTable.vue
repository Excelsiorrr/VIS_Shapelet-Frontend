<template>
  <el-drawer
    :model-value="visible"
    title="Class Discrimination Stats"
    size="42%"
    destroy-on-close
    @close="emit('update:visible', false)"
  >
    <div class="class-stats-drawer">
      <div class="drawer-head">
        <div class="drawer-title-group">
          <div class="drawer-title">BClassStatsTable</div>
          <div class="drawer-subtitle">Check which classes this shapelet distinguishes under the current scope and omega.</div>
        </div>
        <div class="drawer-meta" v-if="shapeletId">
          <span>{{ shapeletId }}</span>
          <span>{{ scope }}</span>
          <span>omega {{ Number(omega ?? 0).toFixed(2) }}</span>
        </div>
      </div>

      <el-empty
        v-if="!shapeletId"
        description="Select a shapelet first."
      />

      <el-alert
        v-else-if="errorMessage"
        :title="errorMessage"
        type="warning"
        show-icon
        :closable="false"
      />

      <div v-else class="table-wrap">
        <div class="table-toolbar">
          <div class="toolbar-note">Rows are sorted by {{ sortModeLabel }}.</div>
          <el-segmented
            v-model="sortMode"
            :options="sortOptions"
            size="small"
          />
        </div>

        <el-table
          v-loading="loading"
          :data="sortedItems"
          height="100%"
          stripe
          class="stats-table"
        >
          <el-table-column prop="class_id" label="Class" width="80" />
          <el-table-column label="Prior" min-width="100">
            <template #default="{ row }">{{ percentText(row.prior) }}</template>
          </el-table-column>
          <el-table-column label="Trigger Rate" min-width="120">
            <template #default="{ row }">{{ percentText(row.trigger_rate) }}</template>
          </el-table-column>
          <el-table-column label="Coverage" min-width="110">
            <template #default="{ row }">{{ percentText(row.coverage) }}</template>
          </el-table-column>
          <el-table-column label="Lift" min-width="110">
            <template #default="{ row }">
              <span v-if="row.lift === null" class="lift-muted" title="Lift is null when support is not stable enough.">unstable</span>
              <span v-else class="lift-value">{{ Number(row.lift).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Top Hits" width="110" align="center">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="selectClass(row.class_id)">
                View
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <b-top-hits-panel
          v-if="selectedClassId !== null"
          :visible="true"
          :dataset-name="datasetName"
          :shapelet-id="shapeletId"
          :scope="scope"
          :omega="omega"
          :class-id="selectedClassId"
        />

        <div v-if="warningMessages.length" class="warning-inline">
          <span class="warning-label">Warnings</span>
          <span class="warning-text">{{ warningMessages[0] }}</span>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import axios from "@/scripts/axios.js";
import BTopHitsPanel from "@/components/PartB/BTopHitsPanel.vue";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  datasetName: {
    type: String,
    default: "",
  },
  shapeletId: {
    type: String,
    default: "",
  },
  scope: {
    type: String,
    default: "test",
  },
  omega: {
    type: Number,
    default: 0.1,
  },
});

const emit = defineEmits(["update:visible"]);

const loading = ref(false);
const errorMessage = ref("");
const rows = ref([]);
const warnings = ref([]);
const sortMode = ref("lift");
const selectedClassId = ref(null);

const sortOptions = [
  { label: "Lift", value: "lift" },
  { label: "Trigger", value: "trigger_rate" },
  { label: "Class", value: "class_id" },
];

const sortModeLabel = computed(() => {
  if (sortMode.value === "trigger_rate") return "trigger rate";
  if (sortMode.value === "class_id") return "class id";
  return "lift";
});

const warningMessages = computed(() =>
  Array.isArray(warnings.value) ? warnings.value.map((item) => item?.message).filter(Boolean) : []
);

const percentText = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${(numeric * 100).toFixed(1)}%`;
};

const sortedItems = computed(() => {
  const copied = [...rows.value];
  if (sortMode.value === "class_id") {
    return copied.sort((a, b) => Number(a.class_id) - Number(b.class_id));
  }
  if (sortMode.value === "trigger_rate") {
    return copied.sort((a, b) => Number(b.trigger_rate) - Number(a.trigger_rate));
  }
  return copied.sort((a, b) => {
    const aLift = a.lift === null || a.lift === undefined ? -Infinity : Number(a.lift);
    const bLift = b.lift === null || b.lift === undefined ? -Infinity : Number(b.lift);
    if (bLift !== aLift) return bLift - aLift;
    return Number(b.trigger_rate) - Number(a.trigger_rate);
  });
});

const selectClass = (classId) => {
  selectedClassId.value = Number(classId);
};

const fetchClassStats = async () => {
  if (!props.visible || !props.datasetName || !props.shapeletId) {
    rows.value = [];
    warnings.value = [];
    errorMessage.value = "";
    selectedClassId.value = null;
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${props.datasetName}/shapelets/${props.shapeletId}/stats/classes`,
      params: {
        scope: props.scope,
        omega: props.omega,
      },
    });
    const data = response.data || {};
    rows.value = Array.isArray(data.items) ? data.items : [];
    warnings.value = Array.isArray(data.warnings) ? data.warnings : [];
    selectedClassId.value = rows.value.length ? Number(rows.value[0].class_id) : null;
  } catch (error) {
    console.log("error", error);
    rows.value = [];
    warnings.value = [];
    errorMessage.value = "Failed to load class discrimination stats.";
    selectedClassId.value = null;
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.visible, props.datasetName, props.shapeletId, props.scope, props.omega],
  () => {
    fetchClassStats();
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.class-stats-drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.drawer-title {
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.drawer-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.drawer-meta {
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

.table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.toolbar-note {
  font-size: 12px;
  color: #64748b;
}

.stats-table {
  flex: 1;
  min-height: 0;
}

.lift-muted {
  color: #94a3b8;
  font-style: italic;
}

.lift-value {
  color: #0f172a;
  font-weight: 700;
}

.warning-inline {
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff8e8;
  border: 1px solid #fde7b2;
  font-size: 12px;
  color: #92400e;
  display: flex;
  gap: 8px;
}

.warning-label {
  font-weight: 700;
}
</style>
