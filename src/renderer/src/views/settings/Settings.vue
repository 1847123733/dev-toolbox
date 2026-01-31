<script setup lang="ts">
import { ref, onMounted } from 'vue'

const proxyUrl = ref('')
const loading = ref(false)
const autoLaunch = ref(false)
const autoLaunchLoading = ref(false)

onMounted(async () => {
  // 获取当前代理设置
  const savedProxy = localStorage.getItem('app_proxy_url')
  if (savedProxy) {
    proxyUrl.value = savedProxy
    await window.api.app.setProxy(savedProxy)
  }

  // 获取开机自启动状态
  try {
    autoLaunch.value = await window.api.app.getAutoLaunch()
  } catch (error) {
    console.error('Failed to get auto launch status:', error)
  }
})

const saveProxy = async () => {
  loading.value = true
  try {
    const url = proxyUrl.value.trim()
    await window.api.app.setProxy(url)

    if (url) {
      localStorage.setItem('app_proxy_url', url)
    } else {
      localStorage.removeItem('app_proxy_url')
    }
  } catch (error) {
    console.error('Failed to set proxy:', error)
  } finally {
    loading.value = false
  }
}

const clearProxy = async () => {
  proxyUrl.value = ''
  await saveProxy()
}

const toggleAutoLaunch = async () => {
  autoLaunchLoading.value = true
  try {
    const newValue = !autoLaunch.value
    await window.api.app.setAutoLaunch(newValue)
    autoLaunch.value = newValue
  } catch (error) {
    console.error('Failed to set auto launch:', error)
  } finally {
    autoLaunchLoading.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--color-surface)]">
    <div class="p-6 border-b border-[var(--color-border)]">
      <h2 class="text-xl font-bold text-[var(--color-text)]">设置</h2>
      <p class="text-sm text-[var(--color-text-muted)] mt-1">应用程序全局设置</p>
    </div>

    <div class="flex-1 overflow-y-auto p-6">
      <!-- 通用设置 -->
      <section class="mb-8">
        <h3 class="text-lg font-medium text-[var(--color-text)] mb-4">通用</h3>

        <div
          class="bg-[var(--color-surface-light)] rounded-xl border border-[var(--color-border)] p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text)]">开机自启动</label>
              <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                开启后，系统启动时将自动运行此应用程序
              </p>
            </div>
            <button
              @click="toggleAutoLaunch"
              :disabled="autoLaunchLoading"
              class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              :class="autoLaunch ? 'bg-indigo-500' : 'bg-gray-500'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="autoLaunch ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>
      </section>

      <!-- 网络设置 -->
      <section class="mb-8">
        <h3 class="text-lg font-medium text-[var(--color-text)] mb-4">网络</h3>

        <div
          class="bg-[var(--color-surface-light)] rounded-xl border border-[var(--color-border)] p-4"
        >
          <div class="mb-4">
            <label class="block text-sm font-medium text-[var(--color-text)] mb-2">HTTP 代理</label>
            <div class="relative">
              <input
                v-model="proxyUrl"
                type="text"
                placeholder="http://127.0.0.1:7890"
                class="w-full px-3 py-2 bg-[var(--color-surface-lighter)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                @change="saveProxy"
              />
            </div>
            <p class="mt-2 text-xs text-[var(--color-text-muted)]">
              设置应用程序的网络代理。支持 HTTP 和 HTTPS。留空则不使用代理。
            </p>
          </div>

          <div class="flex gap-2">
            <button
              @click="saveProxy"
              class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              :disabled="loading"
            >
              <span v-if="loading" class="animate-spin text-white">⏳</span>
              <span>保存</span>
            </button>
            <button
              @click="clearProxy"
              class="px-4 py-2 bg-[var(--color-surface-lighter)] hover:bg-[var(--color-surface-light)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-medium rounded-lg transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      </section>

      <!-- 其他设置占位 -->
    </div>
  </div>
</template>
