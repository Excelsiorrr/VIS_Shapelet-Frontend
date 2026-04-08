<template>
  <el-card class="gallery-card" shadow="never">
    <div class="gallery-header">
      <div class="title">Shapelet 列表</div>
      <div class="meta">
        <span>Total: {{ total }}</span>
        <el-button size="small" @click="$emit('refresh')" :disabled="loading">Refresh</el-button>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="6" animated />

    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="warning"
      show-icon
      :closable="false"
      class="state-alert"
    />

    <el-empty v-else-if="!items.length" description="No shapelet data." />

    <div v-else class="gallery-content">
      <div class="hero-preview" v-if="activeItem">
        <div class="hero-top">
          <div class="hero-id">{{ activeItem.shapelet_id }}</div>
          <div class="hero-len">len={{ activeItem.shapelet_len }}</div>
        </div>

        <div class="hero-canvas">
          <svg
            v-if="getPreviewPolyline(activeItem, true)"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            class="hero-svg"
          >
            <line x1="0" y1="50" x2="100" y2="50" class="hero-midline" />
            <polyline :points="getPreviewPolyline(activeItem, true)" class="hero-line" />
          </svg>
          <div v-else class="preview-empty">No prototype preview</div>
        </div>

        <div class="hero-bottom">
          <span class="ckpt">ckpt: {{ activeItem.ckpt_id || "N/A" }}</span>
          <span class="preview-count">preview={{ (activeItem.sample_ids_preview || []).length }}</span>
        </div>
      </div>

      <div class="gallery-list">
        <div
          v-for="item in items"
          :key="item.shapelet_id"
          class="gallery-item"
          :class="{ active: String(selectedShapeletId) === String(item.shapelet_id) }"
          @click="$emit('select-shapelet', item.shapelet_id)"
        >
          <div class="item-main">
            <div class="item-id">{{ item.shapelet_id }}</div>
            <div class="item-len">len={{ item.shapelet_len }}</div>
          </div>
          <div class="item-sparkline">
            <svg
              v-if="getPreviewPolyline(item)"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
              class="sparkline-svg"
            >
              <polyline :points="getPreviewPolyline(item)" class="sparkline-line" />
            </svg>
            <div v-else class="preview-empty">No prototype</div>
          </div>
        </div>
      </div>
    </div>

  </el-card>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  total: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: "",
  },
  selectedShapeletId: {
    type: [String, Number],
    default: "",
  },
});

const emit = defineEmits(["select-shapelet", "refresh"]);

const activeItem = computed(() => {
  const selected = props.items.find(
    (item) => String(item?.shapelet_id) === String(props.selectedShapeletId)
  );
  return selected || props.items[0] || null;
});

const toNumericArray = (value) => {
  if (!Array.isArray(value)) return [];
  const numeric = value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return numeric;
};

const sequenceForPreview = (item) => {
  const proto = item?.prototype;
  if (!Array.isArray(proto) || !proto.length) return [];

  return proto
    .map((row) => {
      if (Array.isArray(row)) {
        const rowVals = toNumericArray(row);
        if (!rowVals.length) return NaN;
        const sum = rowVals.reduce((acc, cur) => acc + cur, 0);
        return sum / rowVals.length;
      }
      const scalar = Number(row);
      return Number.isFinite(scalar) ? scalar : NaN;
    })
    .filter((v) => Number.isFinite(v));
};

const quantile = (sorted, q) => {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * q;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  const weight = idx - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
};

const getPreviewPolyline = (item, large = false) => {
  const seq = sequenceForPreview(item);
  const n = seq.length;
  if (!n) return "";

  const width = 100;
  const height = large ? 100 : 30;
  const pad = large ? 8 : 4;

  if (n === 1) {
    const y = height / 2;
    return `0,${y.toFixed(2)} ${width},${y.toFixed(2)}`;
  }

  const sorted = [...seq].sort((a, b) => a - b);
  const p05 = quantile(sorted, 0.05);
  const p95 = quantile(sorted, 0.95);

  let min = Number.isFinite(p05) ? p05 : sorted[0];
  let max = Number.isFinite(p95) ? p95 : sorted[sorted.length - 1];

  if (!(max > min)) {
    min = sorted[0];
    max = sorted[sorted.length - 1];
  }

  const span = Math.max(max - min, 1e-9);
  const innerHeight = height - pad * 2;

  return seq
    .map((value, i) => {
      const clipped = Math.min(max, Math.max(min, value));
      const x = (i / (n - 1)) * width;
      const y = pad + innerHeight * (1 - (clipped - min) / span);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

</script>

<style scoped lang="scss">
.gallery-card {
  border: 1px solid #e3e8ef;
  border-radius: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }

  .gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

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
    }
  }

  .state-alert {
    margin-top: 4px;
  }

  .gallery-content {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(150px, 28%) minmax(0, 72%);
    gap: 10px;
  }

  .hero-preview {
    border: 1px solid #dbe7ff;
    border-radius: 8px;
    background: linear-gradient(180deg, #f8fbff 0%, #f0f6ff 100%);
    padding: 10px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 8px;
    min-height: 0;

    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }

    .hero-id {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.2px;
    }

    .hero-len {
      font-size: 12px;
      color: #475569;
    }

    .hero-canvas {
      min-height: 0;
      border: 1px solid #d7e2f5;
      border-radius: 6px;
      background: #ffffff;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      .hero-svg {
        width: 100%;
        height: 100%;
      }

      .hero-midline {
        stroke: #cdd5e1;
        stroke-width: 0.9;
        stroke-dasharray: 3 3;
      }

      .hero-line {
        fill: none;
        stroke: #1d4ed8;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
    }

    .hero-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
    }
  }

  .gallery-list {
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }

  .gallery-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;

    &:hover {
      border-color: #93c5fd;
      box-shadow: 0 2px 6px rgba(29, 78, 216, 0.08);
      background: #f8fbff;
    }

    &.active {
      border-color: #3b82f6;
      background: #eff6ff;
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.18);
    }

    .item-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .item-id {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }

    .item-len {
      font-size: 12px;
      color: #475569;
    }

    .item-sparkline {
      border: 1px solid #e6edf8;
      border-radius: 6px;
      background: #f8fbff;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;

      .sparkline-svg {
        width: 100%;
        height: 100%;
      }

      .sparkline-line {
        fill: none;
        stroke: #2563eb;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
    }
  }

  .preview-empty {
    font-size: 11px;
    color: #94a3b8;
  }

}

@media (max-width: 1280px) {
  .gallery-card {
    .gallery-content {
      grid-template-rows: minmax(140px, 24%) minmax(0, 76%);
    }

    .hero-preview .hero-id {
      font-size: 16px;
    }
  }
}
</style>
