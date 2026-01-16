<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { loadTypeDefinition, reloadTypeDefinition } from '@/utils/typeLoader'

interface NpmPackage {
  name: string
  version: string
  description?: string
}

interface InstalledPackage {
  name: string
  version: string
  installed: boolean
}

// 搜索关键词
const searchQuery = ref('')
// 搜索结果
const searchResults = ref<NpmPackage[]>([])
// 已安装的包
const installedPackages = ref<InstalledPackage[]>([])
// 正在安装的包
const installingPackages = ref<Set<string>>(new Set())
// 搜索中
const isSearching = ref(false)
// 显示搜索结果
const showSearchResults = ref(false)
// 当前展开版本选择的包
const expandedPackage = ref<string | null>(null)
// 版本列表
const versions = ref<string[]>([])
// 正在加载版本
const loadingVersions = ref(false)
// 正在切换版本
const changingVersion = ref<string | null>(null)
// 版本搜索关键词
const versionSearchQuery = ref('')

// 过滤后的版本列表
const filteredVersions = computed(() => {
  const query = versionSearchQuery.value.trim().toLowerCase()
  if (!query) {
    return versions.value.slice(0, 20)
  }
  // 搜索匹配的版本
  return versions.value.filter(v => v.toLowerCase().includes(query))
})

// 加载已安装的包
const loadInstalledPackages = async () => {
  try {
    installedPackages.value = await window.api.npm.list()
  } catch (error) {
    console.error('加载包列表失败:', error)
  }
}

// 搜索包
const searchPackages = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    showSearchResults.value = false
    return
  }

  isSearching.value = true
  showSearchResults.value = true

  try {
    searchResults.value = await window.api.npm.search(searchQuery.value)
  } catch (error) {
    console.error('搜索失败:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// 安装包
const installPackage = async (packageName: string) => {
  if (installingPackages.value.has(packageName)) return

  installingPackages.value.add(packageName)

  try {
    const result = await window.api.npm.install(packageName)
    if (result.success) {
      await loadInstalledPackages()
      // 安装成功后加载类型定义
      loadTypeDefinition(packageName)
    }
  } catch (error) {
    console.error('安装失败:', error)
  } finally {
    installingPackages.value.delete(packageName)
  }
}

// 卸载包
const uninstallPackage = async (packageName: string) => {
  try {
    const result = await window.api.npm.uninstall(packageName)
    if (result.success) {
      await loadInstalledPackages()
    }
  } catch (error) {
    console.error('卸载失败:', error)
  }
}

// 检查包是否已安装
const isInstalled = (packageName: string): boolean => {
  return installedPackages.value.some((p) => p.name === packageName)
}

// 获取包的所有版本
const loadVersions = async (packageName: string) => {
  if (expandedPackage.value === packageName) {
    expandedPackage.value = null
    return
  }

  expandedPackage.value = packageName
  loadingVersions.value = true
  versions.value = []
  versionSearchQuery.value = '' // 清空搜索

  try {
    versions.value = await window.api.npm.versions(packageName)
    console.log("🚀 ~ loadVersions ~ versions.value:", versions.value)
  } catch (error) {
    console.error('获取版本失败:', error)
  } finally {
    loadingVersions.value = false
  }
}

// 切换版本
const changeVersion = async (packageName: string, newVersion: string) => {
  changingVersion.value = `${packageName}@${newVersion}`

  try {
    const result = await window.api.npm.changeVersion(packageName, newVersion)
    if (result.success) {
      await loadInstalledPackages()
      expandedPackage.value = null
      // 版本切换成功后重新加载类型定义
      reloadTypeDefinition(packageName)
    }
  } catch (error) {
    console.error('切换版本失败:', error)
  } finally {
    changingVersion.value = null
  }
}

// 获取当前安装的版本
const getCurrentVersion = (packageName: string): string => {
  const pkg = installedPackages.value.find((p) => p.name === packageName)
  return pkg?.version || ''
}

// 使用防抖搜索
let searchTimeout: number
const handleSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    searchPackages()
  }, 300)
}

// 当前 NPM 目录
const currentNpmDir = ref('')

// 加载当前 NPM 目录
const loadNpmDir = async () => {
  try {
    currentNpmDir.value = await window.api.npm.getDir()
  } catch (error) {
    console.error('获取 NPM 目录失败:', error)
  }
}

// 更改 NPM 目录
const changeNpmDir = async () => {
  try {
    const result = await window.api.npm.setDir()
    if (result.success && result.path) {
      currentNpmDir.value = result.path
      // 重新加载列表
      await loadInstalledPackages()
    }
  } catch (error) {
    console.error('更改 NPM 目录失败:', error)
  }
}

// 重置 NPM 目录
const resetNpmDir = async () => {
  try {
    const result = await window.api.npm.resetDir()
    if (result.success) {
      currentNpmDir.value = result.path
      await loadInstalledPackages()
    }
  } catch (error) {
    console.error('重置 NPM 目录失败:', error)
  }
}

onMounted(() => {
  loadInstalledPackages()
  loadNpmDir()
})
</script>

<template>
  <div class="npm-panel h-full flex flex-col">
    <!-- 搜索框 -->
    <div class="search-box p-4">
      <div class="relative">
        <input
          v-model="searchQuery"
          @input="handleSearchInput"
          @focus="showSearchResults = searchResults.length > 0"
          type="text"
          placeholder="搜索 npm 包..."
          class="w-full pl-10 pr-4 py-2.5 bg-[#2a2a3e] border border-[#3f3f5a] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
        <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <!-- 搜索结果下拉 -->
      <Transition name="fade">
        <div
          v-if="showSearchResults && searchQuery"
          class="search-results absolute left-4 right-4 mt-2 bg-[#2a2a3e] border border-[#3f3f5a] rounded-xl shadow-2xl z-10 max-h-56 overflow-auto"
        >
          <div v-if="isSearching" class="p-4 text-center text-sm text-gray-400">
            <div class="inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            搜索中...
          </div>
          <div v-else-if="searchResults.length === 0" class="p-4 text-center text-sm text-gray-500">
            未找到相关包
          </div>
          <div v-else>
            <button
              v-for="pkg in searchResults.slice(0, 5)"
              :key="pkg.name"
              @click="installPackage(pkg.name)"
              class="w-full px-4 py-3 text-left hover:bg-[#363651] transition-colors flex items-center justify-between group first:rounded-t-xl last:rounded-b-xl"
              :disabled="isInstalled(pkg.name) || installingPackages.has(pkg.name)"
            >
              <div class="min-w-0">
                <div class="text-sm text-white font-medium truncate">{{ pkg.name }}</div>
                <div class="text-xs text-gray-500">{{ pkg.version }}</div>
              </div>
              <span v-if="isInstalled(pkg.name)" class="text-xs text-green-500 font-medium">
                ✓ 已安装
              </span>
              <span v-else-if="installingPackages.has(pkg.name)" class="text-xs text-indigo-400">
                安装中...
              </span>
              <span v-else class="text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                + 安装
              </span>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 已安装的包列表 -->
    <div class="installed-list flex-1 overflow-auto px-4 pb-4">
      <div v-if="installedPackages.length === 0" class="text-center text-sm text-gray-500 py-8">
        <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#2a2a3e] flex items-center justify-center">
          <svg class="w-6 h-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        暂无安装的包
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="pkg in installedPackages"
          :key="pkg.name"
          class="package-item rounded-xl bg-[#2a2a3e] overflow-hidden transition-all"
        >
          <!-- 包信息行 -->
          <div class="flex items-center justify-between px-4 py-3 hover:bg-[#363651] group">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="text-sm text-white font-medium truncate">{{ pkg.name }}</div>
                <!-- 版本可点击切换 -->
                <button
                  @click="loadVersions(pkg.name)"
                  class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  {{ pkg.version }}
                  <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': expandedPackage === pkg.name }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              @click="uninstallPackage(pkg.name)"
              class="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              title="卸载"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <!-- 版本选择下拉 -->
          <Transition name="slide">
            <div v-if="expandedPackage === pkg.name" class="border-t border-[#3f3f5a] bg-[#252536]">
              <div v-if="loadingVersions" class="p-3 text-center text-xs text-gray-400">
                <div class="inline-block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                加载版本...
              </div>
              <div v-else class="p-2">
                <!-- 版本搜索框 -->
                <div class="relative mb-2">
                  <input
                    v-model="versionSearchQuery"
                    type="text"
                    placeholder="搜索版本号..."
                    class="w-full pl-8 pr-3 py-1.5 bg-[#1e1e2e] border border-[#3f3f5a] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                  <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                <!-- 版本列表 -->
                <div class="max-h-32 overflow-auto">
                  <div v-if="filteredVersions.length === 0" class="text-xs text-gray-500 text-center py-2">
                    未找到版本 "{{ versionSearchQuery }}"
                  </div>
                  <button
                    v-for="v in filteredVersions"
                    :key="v"
                    @click="changeVersion(pkg.name, v)"
                    :disabled="changingVersion === `${pkg.name}@${v}` || v === getCurrentVersion(pkg.name)"
                    class="w-full px-3 py-1.5 text-left text-xs rounded-lg transition-colors flex items-center justify-between"
                    :class="v === getCurrentVersion(pkg.name) 
                      ? 'bg-indigo-500/20 text-indigo-400' 
                      : 'text-gray-300 hover:bg-[#363651]'"
                  >
                    <span>{{ v }}</span>
                    <span v-if="v === getCurrentVersion(pkg.name)" class="text-[10px] text-indigo-400">当前</span>
                    <span v-else-if="changingVersion === `${pkg.name}@${v}`" class="text-[10px] text-indigo-400">切换中...</span>
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="p-3 border-t border-[#3f3f5a] text-xs text-gray-400 bg-[#252536]">
      <div class="flex items-center justify-between mb-1">
        <span>安装位置:</span>
        <div class="flex gap-2">
           <button 
            @click="changeNpmDir" 
            class="text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            更改
          </button>
          <button 
            @click="resetNpmDir" 
            class="text-gray-500 hover:text-gray-400 transition-colors"
            title="重置为默认"
          >
            重置
          </button>
        </div>
      </div>
      <div class="truncate opacity-70" :title="currentNpmDir">{{ currentNpmDir || '加载中...' }}</div>
    </div>
  </div>
</template>

<style scoped>
.npm-panel {
  position: relative;
  background: #1e1e2e;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 200px;
}
</style>
