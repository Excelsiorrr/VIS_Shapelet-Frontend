<template>
  <div class="info-leftbar">
    <div class="one-line">
      <div class="dataset-selector">
        <div class="data-selector-title">Dataset:</div>
        <el-select
          v-model="datasetName"
          placeholder="Select"
          style="width: 240px"
        >
          <el-option
            v-for="item in dataSetList"
            :key="item.dataset"
            :label="item.display_name"
            :value="item.dataset"
          />
        </el-select>
      </div>
      <el-button type="primary">Confirm</el-button>
    </div>
  </div>
</template>

<script setup>
import axios from "@/scripts/axios.js";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
const router = useRouter();
const dataSetList = ref([]);
const datasetName = ref();
const getDatasetList = async () => {
  try {
    let response = await axios({
      method: "get",
      url: "v1/part-a/datasets",
    });
    console.log(response);
    dataSetList.value = response.data.datasets;
  } catch (error) {
    console.log("error", error);
  }
};
onMounted(() => {
  getDatasetList();
});
</script>

<style lang="scss">
.info-leftbar {
  width: 400px;
  font-size: 20px;
  position: relative;
  padding-left: 16px;
  padding-right: 16px;
  padding-top: 1vh;
  height: 99vh;
  overflow-y: auto; /* 当内容过多时y轴出现滚动条 */
  background-color: #e0eeee55;
  .one-line {
    display: flex;
  }
  .dataset-selector {
    align-items: center;
    display: flex;
    gap: 8px;
    flex: 1;
    &-title {
      font-size: 16px;
    }
    .el-select {
        width: 150px!important;
    }
  }
}
</style>
