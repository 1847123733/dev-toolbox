<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

// Dock 应用项接口
interface DockApp {
  id: string
  name: string
  icon: string
  action: string
  actionValue?: string
  type?: 'separator'
}

// Dock 窗口是否已打开
const isDockOpen = ref(false)

// Dock 设置
const dockSettings = ref({
  position: 'bottom' as 'bottom' | 'left' | 'right',
  iconSize: 48,
  autoHide: false,
  magnification: true,
  apps: [
    { id: 'finder', name: '访达', icon: 'finder', action: 'openFolder' },
    { id: 'terminal', name: '终端', icon: 'terminal', action: 'openTerminal' },
    { id: 'browser', name: '浏览器', icon: 'browser', action: 'openBrowser' },
    { id: 'separator', name: '', icon: '', action: '', type: 'separator' },
    { id: 'settings', name: '设置', icon: 'settings', action: 'openSettings' }
  ] as DockApp[]
})

// 预设应用列表
const presetApps: DockApp[] = [
  { id: 'finder', name: '访达', icon: 'finder', action: 'openFolder' },
  { id: 'terminal', name: '终端', icon: 'terminal', action: 'openTerminal' },
  { id: 'browser', name: '浏览器', icon: 'browser', action: 'openBrowser' },
  { id: 'settings', name: '设置', icon: 'settings', action: 'openSettings' },
  { id: 'folder', name: '文件夹', icon: 'folder', action: 'openFolder' }
]

// 添加/编辑应用弹窗
const showAddModal = ref(false)
const editIndex = ref<number | null>(null) // 编辑模式时的索引
const customApp = ref({
  name: '',
  icon: 'folder',
  action: 'openUrl',
  actionValue: ''
})

// 图标选项
const iconOptions = ['finder', 'terminal', 'browser', 'settings', 'folder']

// 图标 SVG 定义
const iconSvgs: Record<string, string> = {
  finder: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6H4zm2 2h3v2H6V8zm0 4h3v2H6v-2z"/>
  </svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 17l6-5-6-5M12 19h8"/>
  </svg>`,
  browser: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
  </svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
  </svg>`
}

// 图标对应的背景色
const iconColors: Record<string, string> = {
  finder: 'linear-gradient(135deg, #1E90FF, #4169E1)',
  terminal: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)',
  browser: 'linear-gradient(135deg, #4285F4, #34A853)',
  settings: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  folder: 'linear-gradient(135deg, #60A5FA, #3B82F6)'
}

// 拖拽相关
const dragIndex = ref<number | null>(null)

// 检查 Dock 窗口状态
const checkDockStatus = async () => {
  isDockOpen.value = await window.api.dock.isOpen()
}

// 从本地存储加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('dockSettings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      dockSettings.value = { ...dockSettings.value, ...parsed }
    } catch (e) {
      console.error('Failed to load dock settings:', e)
    }
  }
}

// 保存设置到本地存储
const saveSettings = () => {
  localStorage.setItem('dockSettings', JSON.stringify(dockSettings.value))
}

// 监听设置变化
watch(dockSettings, saveSettings, { deep: true })

// 打开 Dock 窗口
const openDock = async () => {
  // 使用 JSON 深拷贝去除 Vue 响应式包装，否则 IPC 无法克隆
  const settings = JSON.parse(JSON.stringify({
    position: dockSettings.value.position,
    iconSize: dockSettings.value.iconSize,
    autoHide: dockSettings.value.autoHide,
    magnification: dockSettings.value.magnification,
    apps: dockSettings.value.apps
  }))
  const result = await window.api.dock.open(settings)
  if (result.success) {
    isDockOpen.value = true
  }
}

// 关闭 Dock 窗口
const closeDock = async () => {
  const result = await window.api.dock.close()
  if (result.success) {
    isDockOpen.value = false
  }
}

// 添加预设应用
const addPresetApp = (app: DockApp) => {
  const newApp = { ...app, id: `${app.id}-${Date.now()}` }
  dockSettings.value.apps.push(newApp)
  showAddModal.value = false
}

// 添加自定义应用
const addCustomApp = () => {
  if (!customApp.value.name) return
  
  const action = customApp.value.action === 'openUrl' 
    ? `openUrl:${customApp.value.actionValue}`
    : customApp.value.action === 'openApp'
    ? `openApp:${customApp.value.actionValue}`
    : customApp.value.action // 预设动作
  
  const newApp: DockApp = {
    id: `custom-${Date.now()}`,
    name: customApp.value.name,
    icon: customApp.value.icon,
    action: action
  }
  
  if (editIndex.value !== null) {
    // 编辑模式：更新现有应用
    dockSettings.value.apps[editIndex.value] = { ...newApp, id: dockSettings.value.apps[editIndex.value].id }
    editIndex.value = null
  } else {
    // 添加模式
    dockSettings.value.apps.push(newApp)
  }
  
  showAddModal.value = false
  customApp.value = { name: '', icon: 'folder', action: 'openUrl', actionValue: '' }
}

// 编辑应用
const editApp = (index: number) => {
  const app = dockSettings.value.apps[index]
  if (app.type === 'separator') return
  
  editIndex.value = index
  
  // 解析动作类型和值
  if (app.action.startsWith('openUrl:')) {
    customApp.value = {
      name: app.name,
      icon: app.icon,
      action: 'openUrl',
      actionValue: app.action.substring('openUrl:'.length)
    }
  } else if (app.action.startsWith('openApp:')) {
    customApp.value = {
      name: app.name,
      icon: app.icon,
      action: 'openApp',
      actionValue: app.action.substring('openApp:'.length)
    }
  } else {
    // 预设动作
    customApp.value = {
      name: app.name,
      icon: app.icon,
      action: app.action,
      actionValue: ''
    }
  }
  
  showAddModal.value = true
}

// 关闭弹窗
const closeModal = () => {
  showAddModal.value = false
  editIndex.value = null
  customApp.value = { name: '', icon: 'folder', action: 'openUrl', actionValue: '' }
}

// 添加分隔线
const addSeparator = () => {
  dockSettings.value.apps.push({
    id: `separator-${Date.now()}`,
    name: '',
    icon: '',
    action: '',
    type: 'separator'
  })
}

// 删除应用
const removeApp = (index: number) => {
  dockSettings.value.apps.splice(index, 1)
}

// 拖拽开始
const onDragStart = (index: number) => {
  dragIndex.value = index
}

// 拖拽经过
const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (dragIndex.value === null || dragIndex.value === index) return
  
  const apps = dockSettings.value.apps
  const draggedItem = apps[dragIndex.value]
  apps.splice(dragIndex.value, 1)
  apps.splice(index, 0, draggedItem)
  dragIndex.value = index
}

// 拖拽结束
const onDragEnd = () => {
  dragIndex.value = null
}

onMounted(() => {
  loadSettings()
  checkDockStatus()
})
</script>

<template>
  <div class="dock-settings h-full flex flex-col p-6 overflow-auto">
    <!-- 标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-[var(--color-text)] flex items-center gap-3">
        <svg class="w-8 h-8 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="16" width="20" height="5" rx="1" stroke-width="2" />
          <circle cx="6" cy="18.5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="18.5" r="1.5" fill="currentColor" />
          <circle cx="18" cy="18.5" r="1.5" fill="currentColor" />
        </svg>
        macOS Dock
      </h1>
      <p class="text-[var(--color-text-muted)] mt-2">
        模仿 macOS 底部任务栏，创建一个独立的 Dock 窗口
      </p>
    </div>

    <!-- 状态卡片 -->
    <div class="card bg-[var(--color-surface-light)] border border-[var(--color-border)] mb-6">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div :class="['w-3 h-3 rounded-full', isDockOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-500']"></div>
            <span class="text-[var(--color-text)]">
              Dock 窗口状态: <strong>{{ isDockOpen ? '运行中' : '未启动' }}</strong>
            </span>
          </div>
          <button v-if="!isDockOpen" @click="openDock" class="btn btn-primary btn-sm gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            启动 Dock
          </button>
          <button v-else @click="closeDock" class="btn btn-error btn-sm gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            关闭 Dock
          </button>
        </div>
      </div>
    </div>

    <!-- 应用管理区域 -->
    <div class="card bg-[var(--color-surface-light)] border border-[var(--color-border)] mb-6">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h2 class="card-title text-[var(--color-text)]">Dock 应用管理</h2>
          <div class="flex gap-2">
            <button @click="addSeparator" class="btn btn-ghost btn-sm border border-[var(--color-border)]">
              + 分隔线
            </button>
            <button @click="showAddModal = true" class="btn btn-primary btn-sm">
              + 添加应用
            </button>
          </div>
        </div>
        
        <!-- 应用列表 -->
        <div class="space-y-2">
          <div
            v-for="(app, index) in dockSettings.apps"
            :key="app.id"
            :draggable="true"
            @dragstart="onDragStart(index)"
            @dragover="(e) => onDragOver(e, index)"
            @dragend="onDragEnd"
            :class="[
              'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move',
              dragIndex === index 
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' 
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
            ]"
          >
            <!-- 拖拽手柄 -->
            <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
            </svg>
            
            <template v-if="app.type === 'separator'">
              <div class="flex-1 h-px bg-[var(--color-border)]"></div>
              <span class="text-[var(--color-text-muted)] text-sm">分隔线</span>
            </template>
            <template v-else>
              <!-- 图标 -->
              <div 
                class="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                :style="{ background: iconColors[app.icon] || iconColors.folder }"
              >
                <div class="w-5 h-5" v-html="iconSvgs[app.icon] || iconSvgs.folder"></div>
              </div>
              <!-- 名称 -->
              <span class="flex-1 text-[var(--color-text)]">{{ app.name }}</span>
              <!-- 动作 -->
              <span class="text-[var(--color-text-muted)] text-sm">{{ app.action }}</span>
            </template>
            
            <!-- 编辑按钮 -->
            <button 
              v-if="app.type !== 'separator'"
              @click="editApp(index)" 
              class="btn btn-ghost btn-xs text-blue-500 hover:bg-blue-500/10"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            
            <!-- 删除按钮 -->
            <button 
              @click="removeApp(index)" 
              class="btn btn-ghost btn-xs text-red-500 hover:bg-red-500/10"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <p class="text-[var(--color-text-muted)] text-sm mt-3">
          拖拽应用可以调整顺序
        </p>
      </div>
    </div>

    <!-- 设置区域 -->
    <div class="card bg-[var(--color-surface-light)] border border-[var(--color-border)]">
      <div class="card-body">
        <h2 class="card-title text-[var(--color-text)] mb-4">Dock 设置</h2>

        <!-- 位置选择 -->
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text text-[var(--color-text)]">Dock 位置</span>
          </label>
          <div class="flex gap-2">
            <button
              v-for="pos in ['bottom', 'left', 'right']"
              :key="pos"
              @click="dockSettings.position = pos as 'bottom' | 'left' | 'right'"
              :class="[
                'btn btn-sm',
                dockSettings.position === pos ? 'btn-primary' : 'btn-ghost border border-[var(--color-border)]'
              ]"
            >
              {{ pos === 'bottom' ? '底部' : pos === 'left' ? '左侧' : '右侧' }}
            </button>
          </div>
        </div>

        <!-- 图标大小 -->
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text text-[var(--color-text)]">图标大小: {{ dockSettings.iconSize }}px</span>
          </label>
          <input
            type="range"
            v-model.number="dockSettings.iconSize"
            min="32"
            max="128"
            class="range range-primary range-sm"
          />
          <div class="flex justify-between text-xs text-[var(--color-text-muted)] px-1">
            <span>32px</span>
            <span>128px</span>
          </div>
        </div>

        <!-- 自动隐藏 -->
        <div class="form-control mb-4">
          <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" v-model="dockSettings.autoHide" class="checkbox checkbox-primary checkbox-sm" />
            <span class="label-text text-[var(--color-text)]">自动隐藏</span>
          </label>
        </div>

        <!-- 放大效果 -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" v-model="dockSettings.magnification" class="checkbox checkbox-primary checkbox-sm" />
            <span class="label-text text-[var(--color-text)]">鼠标悬停放大效果</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="mt-6 p-4 bg-[var(--color-surface-light)] rounded-lg border border-[var(--color-border)]">
      <h3 class="text-[var(--color-text)] font-medium mb-2 flex items-center gap-2">
        <svg class="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        使用说明
      </h3>
      <ul class="text-sm text-[var(--color-text-muted)] space-y-1 list-disc list-inside">
        <li>点击「启动 Dock」将打开一个独立的 Dock 窗口并隐藏主窗口</li>
        <li>在 Dock 窗口中点击应用图标可以打开相应程序</li>
        <li>点击 Dock 上的设置图标可以重新打开主窗口</li>
        <li>拖拽应用可以调整在 Dock 中的显示顺序</li>
        <li>应用设置会自动保存到本地</li>
      </ul>
    </div>

    <!-- 添加/编辑应用弹窗 -->
    <dialog :class="['modal', showAddModal ? 'modal-open' : '']">
      <div class="modal-box bg-[var(--color-surface-light)] border border-[var(--color-border)]">
        <h3 class="font-bold text-lg text-[var(--color-text)] mb-4">{{ editIndex !== null ? '编辑应用' : '添加应用' }}</h3>
        
        <!-- 预设应用（仅添加模式） -->
        <div v-if="editIndex === null" class="mb-4">
          <p class="text-sm text-[var(--color-text-muted)] mb-2">预设应用</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="app in presetApps"
              :key="app.id"
              @click="addPresetApp(app)"
              class="btn btn-sm btn-ghost border border-[var(--color-border)]"
            >
              {{ app.name }}
            </button>
          </div>
        </div>
        
        <div v-if="editIndex === null" class="divider text-[var(--color-text-muted)]">或自定义</div>
        
        <!-- 自定义应用 -->
        <div class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-[var(--color-text)]">名称</span>
            </label>
            <input 
              v-model="customApp.name" 
              type="text" 
              placeholder="应用名称" 
              class="input input-bordered w-full bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text text-[var(--color-text)]">图标</span>
            </label>
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="icon in iconOptions"
                :key="icon"
                @click="customApp.icon = icon"
                :class="[
                  'w-12 h-12 rounded-lg flex items-center justify-center transition-all border-2 text-white',
                  customApp.icon === icon 
                    ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/50' 
                    : 'border-transparent hover:border-[var(--color-border)]'
                ]"
                :style="{ background: iconColors[icon] }"
                :title="icon"
              >
                <div class="w-7 h-7" v-html="iconSvgs[icon]"></div>
              </button>
            </div>
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text text-[var(--color-text)]">动作类型</span>
            </label>
            <select v-model="customApp.action" class="select select-bordered w-full bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]">
              <option value="openUrl">打开网址</option>
              <option value="openApp">打开应用</option>
            </select>
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text text-[var(--color-text)]">
                {{ customApp.action === 'openUrl' ? '网址' : '应用路径' }}
              </span>
            </label>
            <input 
              v-model="customApp.actionValue" 
              type="text" 
              :placeholder="customApp.action === 'openUrl' ? 'https://example.com' : 'C:\\\\Program Files\\\\...'"
              class="input input-bordered w-full bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
            />
          </div>
          
          <button @click="addCustomApp" class="btn btn-primary w-full">{{ editIndex !== null ? '保存修改' : '添加自定义应用' }}</button>
        </div>
        
        <div class="modal-action">
          <button @click="closeModal" class="btn btn-ghost">取消</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="closeModal">close</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.dock-settings {
  background: var(--color-surface);
}
</style>

