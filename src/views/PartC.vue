<template>
  <div class="part-c-page">
    <div class="part-c-layout">
      <c-match-header
        :dataset-name="datasetName"
        :sample-id="sampleId"
        :scope="resolvedScope"
        :omega="resolvedOmega"
        :source-panel="sourcePanel"
        :pinned-shapelet-id="pinnedShapeletId"
        :pred-class="matchData?.prediction?.pred_class ?? null"
        :margin="matchData?.prediction?.margin ?? null"
        :peak-t="activeWindow?.peak_t ?? null"
        :triggered="activeWindow?.triggered ?? null"
      />

      <el-alert
        v-if="errorMessage"
        class="error-alert"
        type="error"
        :title="errorMessage"
        show-icon
        :closable="false"
      />

      <el-skeleton v-else-if="loading" :rows="10" animated />

      <template v-else-if="matchData">
        <c-warning-banner :warnings="combinedWarnings" />

        <div class="main-panels">
          <c-sequence-evidence-panel
            :sequence="matchData.sequence || []"
            :active-window="activeWindow"
            :prototype="pinnedPrototype"
            :pinned-shapelet-id="pinnedShapeletId"
          />

          <c-match-heatmap-panel
            :shapelet-ids="matchData.shapelet_ids || []"
            :matrix="matchData.I || []"
            :peak-t="matchData.peak_t || []"
            :windows="matchData.windows || []"
            :pinned-shapelet-id="pinnedShapeletId"
            :active-shapelet-id="activeShapeletId"
            :omega="resolvedOmega"
            @hover-shapelet="onHoverShapelet"
            @pin-shapelet="onPinShapelet"
          />
        </div>

        <c-link-action-bar
          :can-copy="Boolean(activeWindow && pinnedShapeletId)"
          :can-open-part-e="Boolean(activeWindow && pinnedShapeletId)"
          :has-pinned="Boolean(pinnedShapeletId)"
          @copy-span="copyPartEPayload"
          @open-part-e="openPartE"
          @clear-pin="clearPinnedShapelet"
        />
      </template>

      <el-empty
        v-else
        description="Part C needs at least dataset and sample_id to inspect a single sample."
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "@/scripts/axios.js";
import CMatchHeader from "@/components/PartC/CMatchHeader.vue";
import CSequenceEvidencePanel from "@/components/PartC/CSequenceEvidencePanel.vue";
import CMatchHeatmapPanel from "@/components/PartC/CMatchHeatmapPanel.vue";
import CLinkActionBar from "@/components/PartC/CLinkActionBar.vue";
import CWarningBanner from "@/components/PartC/CWarningBanner.vue";

const route = useRoute();
const router = useRouter();

const meta = ref(null);
const matchData = ref(null);
const loading = ref(false);
const errorMessage = ref("");
const hoveredShapeletId = ref("");
const prototypeCache = ref({});

const datasetName = computed(() => String(route.query.dataset || localStorage.getItem("shapeletDataset") || "mcce"));
const sampleId = computed(() => String(route.query.sample_id || ""));
const sourcePanel = computed(() => String(route.query.source_panel || "part_a"));
const queryShapeletId = computed(() => String(route.query.shapelet_id || ""));

const resolvedScope = ref("test");
const resolvedOmega = ref(0.02);
const pinnedShapeletId = ref("");

const parseNumber = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const jsonPostConfig = {
  headers: {
    "Content-Type": "application/json",
  },
};

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

const loadMeta = async () => {
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-c/datasets/${datasetName.value}/meta`,
    });
    meta.value = response.data;
    resolvedScope.value = String(route.query.scope || response.data?.scope_default || "test");
    resolvedOmega.value = parseNumber(route.query.omega, response.data?.omega_default ?? 0.02);
  } catch (error) {
    console.log("error", error);
    meta.value = null;
    resolvedScope.value = String(route.query.scope || "test");
    resolvedOmega.value = parseNumber(route.query.omega, 0.02);
  }
};

const loadMatch = async () => {
  if (!datasetName.value || !sampleId.value) {
    matchData.value = null;
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    let response;
    if (sourcePanel.value === "part_b" && queryShapeletId.value) {
      response = await axios({
        method: "post",
        url: "v1/part-c/navigation/from-part-b",
        ...jsonPostConfig,
        data: {
          link: {
            dataset: datasetName.value,
            sample_id: sampleId.value,
            shapelet_id: queryShapeletId.value,
            scope: resolvedScope.value,
            omega: resolvedOmega.value,
            source_panel: "part_b",
            trigger_score: parseNumber(route.query.trigger_score),
            rank: parseNumber(route.query.rank),
            rank_metric: route.query.rank_metric ? String(route.query.rank_metric) : null,
          },
          include_sequence: true,
          include_prediction: true,
          include_windows: true,
        },
      });
      matchData.value = response.data?.match || null;
    } else if (
      sourcePanel.value === "part_e" &&
      queryShapeletId.value &&
      route.query.t_start !== undefined &&
      route.query.t_end !== undefined
    ) {
      response = await axios({
        method: "post",
        url: "v1/part-c/navigation/from-part-e",
        ...jsonPostConfig,
        data: {
          link: {
            dataset: datasetName.value,
            sample_id: sampleId.value,
            shapelet_id: queryShapeletId.value,
            t_start: parseNumber(route.query.t_start, 0),
            t_end: parseNumber(route.query.t_end, 0),
            scope: resolvedScope.value,
            omega: resolvedOmega.value,
            source_panel: "part_e",
            baseline: route.query.baseline ? String(route.query.baseline) : null,
            value_type: route.query.value_type ? String(route.query.value_type) : null,
            target_class: parseNumber(route.query.target_class),
          },
          include_sequence: true,
          include_prediction: true,
          include_windows: true,
        },
      });
      matchData.value = response.data?.match || null;
    } else {
      response = await axios({
        method: "post",
        url: `v1/part-c/datasets/${datasetName.value}/samples/${sampleId.value}/matches`,
        ...jsonPostConfig,
        data: {
          scope: resolvedScope.value,
          omega: resolvedOmega.value,
          shapelet_ids: null,
          topk_shapelets: null,
          pinned_shapelet_id: queryShapeletId.value || null,
          include_sequence: true,
          include_prediction: true,
          include_windows: true,
        },
      });
      matchData.value = response.data || null;
    }

    pinnedShapeletId.value =
      String(matchData.value?.pinned_shapelet?.shapelet_id || queryShapeletId.value || "");
  } catch (error) {
    console.log("error", error);
    errorMessage.value = extractErrorMessage(error, "Failed to load Part C match tensor.");
    matchData.value = null;
  } finally {
    loading.value = false;
  }
};

const windowsByShapelet = computed(() => {
  const map = new Map();
  (matchData.value?.windows || []).forEach((item) => {
    map.set(String(item.shapelet_id), item);
  });
  return map;
});

const activeShapeletId = computed(() => {
  return hoveredShapeletId.value || pinnedShapeletId.value || "";
});

const activeWindow = computed(() => {
  if (sourcePanel.value === "part_e" && route.query.t_start !== undefined && route.query.t_end !== undefined) {
    return {
      shapelet_id: pinnedShapeletId.value || queryShapeletId.value || "",
      start: parseNumber(route.query.t_start, 0),
      end: parseNumber(route.query.t_end, 0),
      peak_t: parseNumber(route.query.t_start, 0),
      triggered: true,
    };
  }
  return windowsByShapelet.value.get(activeShapeletId.value) || null;
});

const combinedWarnings = computed(() => {
  const all = [];
  if (Array.isArray(meta.value?.warnings)) all.push(...meta.value.warnings);
  if (Array.isArray(matchData.value?.warnings)) all.push(...matchData.value.warnings);
  return all;
});

const onHoverShapelet = (shapeletId) => {
  hoveredShapeletId.value = String(shapeletId || "");
};

const onPinShapelet = (shapeletId) => {
  pinnedShapeletId.value = String(shapeletId || "");
  hoveredShapeletId.value = "";
};

const clearPinnedShapelet = () => {
  pinnedShapeletId.value = "";
  hoveredShapeletId.value = "";
};

const copyPartEPayload = async () => {
  if (!activeWindow.value || !pinnedShapeletId.value) return;
  const payload = {
    dataset: datasetName.value,
    sample_id: sampleId.value,
    shapelet_id: pinnedShapeletId.value,
    t_start: activeWindow.value.start,
    t_end: activeWindow.value.end,
    scope: resolvedScope.value,
    omega: resolvedOmega.value,
    source_panel: "part_c",
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.log("clipboard error", error);
  }
};

const openPartE = () => {
  if (!activeWindow.value || !pinnedShapeletId.value) return;
  router.push({
    name: "WhatIfPanel",
    query: {
      dataset: datasetName.value,
      sample_id: sampleId.value,
      shapelet_id: pinnedShapeletId.value,
      t_start: String(activeWindow.value.start),
      t_end: String(activeWindow.value.end),
      scope: resolvedScope.value,
      omega: String(resolvedOmega.value),
      source_panel: "part_c",
    },
  });
};

const loadPage = async () => {
  await loadMeta();
  await loadMatch();
};

const loadPinnedPrototype = async (shapeletId) => {
  const sid = String(shapeletId || "");
  if (!sid || !datasetName.value) return;
  if (prototypeCache.value[sid]) return;
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${datasetName.value}/shapelets/${sid}`,
    });
    const proto = response?.data?.shapelet?.prototype;
    if (Array.isArray(proto)) {
      prototypeCache.value = {
        ...prototypeCache.value,
        [sid]: proto,
      };
    }
  } catch (error) {
    console.log("prototype load error", error);
  }
};

const pinnedPrototype = computed(() => {
  const sid = String(pinnedShapeletId.value || "");
  if (!sid) return null;
  return prototypeCache.value[sid] || null;
});

watch(
  () => route.query,
  () => {
    hoveredShapeletId.value = "";
    prototypeCache.value = {};
    loadPage();
  },
  { deep: true }
);

watch(
  () => [datasetName.value, pinnedShapeletId.value],
  ([, sid]) => {
    loadPinnedPrototype(sid);
  },
  { immediate: true }
);

onMounted(() => {
  loadPage();
});
</script>

<style scoped lang="scss">
.part-c-page {
  width: 100%;
  min-height: 100%;
  height: calc(100vh - 12px);
  padding: 10px 12px;
  box-sizing: border-box;
  background: #f7f9fb;
}

.part-c-layout {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 12px;
}

.error-alert {
  align-self: start;
}

.main-panels {
  min-height: 0;
  display: grid;
  grid-template-columns: 42% 58%;
  gap: 12px;
}

@media (max-width: 1180px) {
  .main-panels {
    grid-template-columns: 1fr;
  }
}
</style>
