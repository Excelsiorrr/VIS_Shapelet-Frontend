<template>
  <div class="part-b-page">
    <div class="layout-main">
      <div class="left-panel">
        <b-meta-bar
          :dataset-name="datasetName"
          :meta="meta"
          :loading="metaLoading"
          :error-message="metaError"
          v-model:scope="scope"
          v-model:omega="omega"
          @refresh="fetchMeta"
        />

        <b-shapelet-gallery
          :items="galleryItems"
          :total="galleryTotal"
          :loading="galleryLoading"
          :error-message="galleryError"
          :selected-shapelet-id="selectedShapeletId"
          @select-shapelet="onSelectShapelet"
          @refresh="fetchGallery"
        />
      </div>

      <div class="right-panel">
        <b-histogram-panel
          :dataset-name="datasetName"
          :scope="scope"
          :shapelet-id="selectedShapeletId"
          :omega="omega"
        />
      </div>

      <div class="evidence-panel">
        <b-shapelet-evidence-panel
          :dataset-name="datasetName"
          :scope="scope"
          :shapelet-id="selectedShapeletId"
          :omega="omega"
          @open-class-stats="classStatsVisible = true"
        />
      </div>

      <b-class-stats-table
        v-model:visible="classStatsVisible"
        :dataset-name="datasetName"
        :shapelet-id="selectedShapeletId"
        :scope="scope"
        :omega="omega"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import axios from "@/scripts/axios.js";
import BMetaBar from "@/components/PartB/BMetaBar.vue";
import BShapeletGallery from "@/components/PartB/BShapeletGallery.vue";
import BHistogramPanel from "@/components/PartB/BHistogramPanel.vue";
import BShapeletEvidencePanel from "@/components/PartB/BShapeletEvidencePanel.vue";
import BClassStatsTable from "@/components/PartB/BClassStatsTable.vue";

const datasetName = ref(localStorage.getItem("shapeletDataset") || "mcce");
const route = useRoute();

const meta = ref(null);
const metaLoading = ref(false);
const metaError = ref("");

const scope = ref("test");
const omega = ref(0.1);

const galleryItems = ref([]);
const galleryTotal = ref(0);
const galleryLoading = ref(false);
const galleryError = ref("");
const selectedShapeletId = ref("");
const galleryLimit = 500;
const classStatsVisible = ref(false);

const parseNumber = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const applyQueryContext = () => {
  datasetName.value = String(route.query.dataset || localStorage.getItem("shapeletDataset") || "mcce");
  const queryScope = route.query.scope ? String(route.query.scope) : "";
  const queryOmega = parseNumber(route.query.omega);
  const queryShapeletId = route.query.shapelet_id ? String(route.query.shapelet_id) : "";

  if (queryScope) scope.value = queryScope;
  if (Number.isFinite(queryOmega)) omega.value = queryOmega;
  if (queryShapeletId) selectedShapeletId.value = queryShapeletId;
};

const fetchMeta = async () => {
  if (!datasetName.value) return;
  metaLoading.value = true;
  metaError.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${datasetName.value}/meta`,
    });
    meta.value = response.data;
    if (response.data?.scope_default) scope.value = response.data.scope_default;
    if (typeof response.data?.omega_default === "number") omega.value = response.data.omega_default;
  } catch (error) {
    console.log("error", error);
    metaError.value = "Failed to load Part B meta.";
    meta.value = null;
  } finally {
    metaLoading.value = false;
  }
};

const fetchGallery = async () => {
  if (!datasetName.value) return;
  galleryLoading.value = true;
  galleryError.value = "";
  try {
    const response = await axios({
      method: "get",
      url: `v1/part-b/datasets/${datasetName.value}/shapelets`,
      params: {
        offset: 0,
        limit: galleryLimit,
      },
    });
    const data = response.data || {};
    galleryItems.value = data.items || [];
    galleryTotal.value = Number(data.total || 0);
    if (galleryItems.value.length) {
      const queryShapeletId = route.query.shapelet_id ? String(route.query.shapelet_id) : "";
      if (queryShapeletId) {
        const exists = galleryItems.value.some(
          (item) => String(item?.shapelet_id || "") === queryShapeletId
        );
        if (exists) {
          selectedShapeletId.value = queryShapeletId;
        }
      }
    }
    if (!selectedShapeletId.value && galleryItems.value.length) {
      selectedShapeletId.value = String(galleryItems.value[0].shapelet_id || "");
    }
  } catch (error) {
    console.log("error", error);
    galleryError.value = "Failed to load shapelet gallery.";
    galleryItems.value = [];
    galleryTotal.value = 0;
  } finally {
    galleryLoading.value = false;
  }
};

const onSelectShapelet = (shapeletId) => {
  selectedShapeletId.value = String(shapeletId || "");
};

watch(
  () => datasetName.value,
  () => {
    fetchMeta();
    selectedShapeletId.value = "";
    fetchGallery();
  }
);

watch(
  () => route.query,
  () => {
    applyQueryContext();
    fetchMeta();
    fetchGallery();
  },
  { deep: true }
);

onMounted(() => {
  applyQueryContext();
  fetchMeta();
  fetchGallery();
});
</script>

<style scoped lang="scss">
.part-b-page {
  width: 100%;
  min-height: 100%;
  height: calc(100vh - 12px);
  padding: 8px 12px;
  box-sizing: border-box;
  background: #f7f9fb;
}

.layout-main {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 29% 71%;
  grid-template-rows: minmax(0, 54%) minmax(340px, 46%);
  gap: 12px;
}

.left-panel {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
}

.right-panel {
  min-width: 0;
  min-height: 0;
  display: block;
  overflow: hidden;
}

.evidence-panel {
  grid-column: 1 / span 2;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
