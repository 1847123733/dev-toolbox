<template>
  <div ref="chartRef" class="chart-renderer" :style="{ height: `${height}px` }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(
  defineProps<{
    config: Record<string, unknown>
    height?: number
  }>(),
  {
    height: 320
  }
)

const chartRef = ref<HTMLElement | null>(null)
let instance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const renderChart = () => {
  if (!chartRef.value) return

  if (!instance) {
    instance = echarts.init(chartRef.value)
  }

  instance.setOption(props.config || {}, true)
}

onMounted(() => {
  renderChart()

  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(() => {
      instance?.resize()
    })
    resizeObserver.observe(chartRef.value)
  }
})

watch(
  () => props.config,
  () => {
    renderChart()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  instance?.dispose()
  instance = null
})
</script>

<style scoped>
.chart-renderer {
  width: 100%;
  min-height: 180px;
}
</style>
