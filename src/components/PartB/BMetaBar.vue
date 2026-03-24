<template>
  <el-card class="meta-card" shadow="never">
    <div class="meta-header">
      <div class="title-block">
        <div class="title">Part B · Shapelet Library</div>
        <div class="sub-title">Dataset: {{ datasetName || "N/A" }}</div>
      </div>
      <el-button size="small" @click="$emit('refresh')" :disabled="loading">Refresh</el-button>
    </div>

    <el-skeleton v-if="loading" :rows="4" animated />

    <el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="warning"
      show-icon
      :closable="false"
    />

    <div v-else-if="meta" class="meta-content">
      <div class="meta-grid">
        <div class="meta-item">
          <div class="label">Spec Version</div>
          <div class="value">{{ meta.spec_version || "N/A" }}</div>
        </div>
        <div class="meta-item">
          <div class="label">Scope</div>
          <el-select
            :model-value="scope"
            size="small"
            style="width: 130px"
            @update:model-value="(v) => $emit('update:scope', v)"
          >
            <el-option label="test" value="test" />
            <el-option label="train" value="train" />
            <el-option label="all" value="all" />
          </el-select>
        </div>
        <div class="meta-item">
          <div class="label">Omega</div>
          <el-input-number
            :model-value="omega"
            :step="0.05"
            :precision="2"
            :min="0"
            :max="1"
            size="small"
            @update:model-value="(v) => $emit('update:omega', v)"
          />
        </div>
        <div class="meta-item">
          <div class="label">Trigger Rule</div>
          <div class="value mono">{{ meta.trigger_rule || "N/A" }}</div>
        </div>
      </div>

      <div class="meta-grid second-row">
        <div class="meta-item">
          <div class="label">Histogram Mode</div>
          <div class="value">{{ meta.histogram_default?.mode || "N/A" }}</div>
        </div>
        <div class="meta-item">
          <div class="label">Bins</div>
          <div class="value">{{ meta.histogram_default?.bins ?? "N/A" }}</div>
        </div>
        <div class="meta-item">
          <div class="label">Density</div>
          <div class="value">{{ meta.histogram_default?.density ? "true" : "false" }}</div>
        </div>
        <div class="meta-item">
          <div class="label">Omega Default</div>
          <div class="value">{{ typeof meta.omega_default === 'number' ? meta.omega_default.toFixed(2) : "N/A" }}</div>
        </div>
      </div>

      <el-collapse v-if="meta.warnings?.length" class="warning-collapse">
        <el-collapse-item :title="`Warnings (${meta.warnings.length})`" name="warnings">
          <ul class="warning-list">
            <li v-for="warning in meta.warnings" :key="warning.code + warning.message">
              <span class="warning-code">{{ warning.code }}:</span>
              <span class="warning-msg">{{ warning.message }}</span>
            </li>
          </ul>
        </el-collapse-item>
      </el-collapse>
    </div>

    <el-empty v-else description="No meta data available." />
  </el-card>
</template>

<script setup>
defineProps({
  datasetName: {
    type: String,
    default: "",
  },
  meta: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
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

defineEmits(["update:scope", "update:omega", "refresh"]);
</script>

<style scoped lang="scss">
.meta-card {
  border: 1px solid #eaecef;
  border-radius: 8px;

  .meta-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;

    .title-block {
      .title {
        font-size: 18px;
        font-weight: 700;
        color: #1f2937;
      }

      .sub-title {
        margin-top: 2px;
        font-size: 13px;
        color: #6b7280;
      }
    }
  }

  .meta-content {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(120px, 1fr));
      gap: 8px 12px;

      .meta-item {
        min-width: 0;

        .label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .value {
          font-size: 14px;
          color: #1f2937;
          word-break: break-word;

          &.mono {
            font-family: Consolas, "Courier New", monospace;
            font-size: 12px;
            color: #374151;
          }
        }
      }
    }

    .warning-collapse {
      margin-top: 4px;

      .warning-list {
        margin: 0;
        padding-left: 16px;

        li {
          margin-bottom: 4px;
          font-size: 13px;

          .warning-code {
            color: #b45309;
            font-weight: 600;
            margin-right: 4px;
          }

          .warning-msg {
            color: #7c2d12;
          }
        }
      }
    }
  }
}
</style>
