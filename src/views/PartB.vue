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

        <el-card class="placeholder-card mid-dynamic" shadow="never">
          <div class="placeholder-title">随 Ω 变化的 Activations 直方图</div>
          <div class="placeholder-desc">R2 将实现 BHistogramDynamicPanel</div>
        </el-card>

        <el-card class="placeholder-card bottom-stats" shadow="never">
          <div class="placeholder-title">Dynamic Summary / Class Stats</div>
          <div class="placeholder-desc">
            R3 将实现 BStatsSummaryCard + BClassStatsTable
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import axios from "@/scripts/axios.js";
import BMetaBar from "@/components/PartB/BMetaBar.vue";
import BShapeletGallery from "@/components/PartB/BShapeletGallery.vue";
import BHistogramPanel from "@/components/PartB/BHistogramPanel.vue";

const datasetName = ref(localStorage.getItem("shapeletDataset") || "mcce");

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

onMounted(() => {
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
  gap: 12px;
}

.left-panel {
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
}

.right-panel {
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: 48% 24% 28%;
  gap: 10px;
}

.placeholder-card {
  border: 1px solid #eaecef;
  border-radius: 8px;
  min-height: 0;

  :deep(.el-card__body) {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }

  .placeholder-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .placeholder-desc {
    font-size: 13px;
    color: #6b7280;
  }
}
</style>
