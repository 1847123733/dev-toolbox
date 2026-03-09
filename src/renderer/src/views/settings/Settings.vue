<script setup lang="ts">
import { ref, onMounted } from 'vue'

const proxyUrl = ref('')
const loading = ref(false)
const autoLaunch = ref(false)
const autoLaunchLoading = ref(false)

onMounted(async () => {
  const savedProxy = localStorage.getItem('app_proxy_url')
  if (savedProxy) {
    proxyUrl.value = savedProxy
    await window.api.app.setProxy(savedProxy)
  }

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
  <div class="settings-page">
    <div class="settings-header">
      <h2 class="settings-title">设置</h2>
      <p class="settings-desc">应用程序全局设置</p>
    </div>

    <div class="settings-body">
      <!-- General -->
      <section class="settings-section">
        <h3 class="section-title">通用</h3>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">开机自启动</label>
              <p class="setting-hint">开启后，系统启动时将自动运行此应用程序</p>
            </div>
            <button
              @click="toggleAutoLaunch"
              :disabled="autoLaunchLoading"
              class="toggle-switch"
              :class="{ on: autoLaunch }"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      </section>

      <!-- Network -->
      <section class="settings-section">
        <h3 class="section-title">网络</h3>
        <div class="settings-card">
          <div class="setting-field">
            <label class="setting-label">HTTP 代理</label>
            <input
              v-model="proxyUrl"
              type="text"
              placeholder="http://127.0.0.1:7890"
              class="setting-input"
              @change="saveProxy"
            />
            <p class="setting-hint">设置应用程序的网络代理。支持 HTTP 和 HTTPS。留空则不使用代理。</p>
          </div>

          <div class="setting-actions">
            <button @click="saveProxy" class="btn-primary-sm" :disabled="loading">
              <span v-if="loading" class="btn-spinner"></span>
              <span>保存</span>
            </button>
            <button @click="clearProxy" class="btn-ghost-sm">清除</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.settings-header {
  padding: 24px 28px;
  border-bottom: 1px solid var(--color-border);
}

.settings-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.settings-desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.settings-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.settings-card {
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-info {
  flex: 1;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.setting-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.setting-field {
  margin-bottom: 16px;
}

.setting-input {
  width: 100%;
  margin-top: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.setting-input:focus {
  border-color: rgba(129, 140, 248, 0.5);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.1);
}

.setting-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 99px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.toggle-switch.on {
  background: var(--color-primary);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transition: transform var(--transition-fast);
}

.toggle-switch.on .toggle-thumb {
  transform: translateX(20px);
}

/* Buttons */
.setting-actions {
  display: flex;
  gap: 8px;
}

.btn-primary-sm {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-primary);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.btn-primary-sm:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-primary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost-sm {
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-ghost-sm:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text);
  border-color: var(--color-border-hover);
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
