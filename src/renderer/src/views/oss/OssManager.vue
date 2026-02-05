<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

interface UploadItem {
  id: string
  name: string
  path: string
  relativePath: string
  size: number
  uploadKey: string
  progress: number
  status: UploadStatus
  message?: string
}

const accessKeyId = shallowRef('')
const accessKeySecret = shallowRef('')
const endpoint = shallowRef('')
const bucket = shallowRef('')
const targetPath = shallowRef('')

const ossConfigStorageKey = 'oss_config_v1'

const isDragging = shallowRef(false)
const isUploading = shallowRef(false)
const uploadTaskId = shallowRef('')

const overallPercent = shallowRef(0)
const overallLoaded = shallowRef(0)
const overallTotal = shallowRef(0)
const currentFile = shallowRef('')

const files = ref<UploadItem[]>([])

const canUpload = computed(() => {
  return (
    accessKeyId.value.trim() &&
    accessKeySecret.value.trim() &&
    endpoint.value.trim() &&
    bucket.value.trim() &&
    files.value.length > 0 &&
    !isUploading.value
  )
})

const displayTargetPath = computed(() => {
  const clean = normalizePath(targetPath.value)
  return clean ? `/${clean}` : '/'
})

watch(
  () => targetPath.value,
  () => {
    if (!isUploading.value) {
      updateUploadKeys()
    }
  }
)

const loadOssConfig = () => {
  const saved = localStorage.getItem(ossConfigStorageKey)
  if (!saved) return
  try {
    const parsed = JSON.parse(saved) as Partial<{
      accessKeyId: string
      accessKeySecret: string
      endpoint: string
      bucket: string
      targetPath: string
    }>
    accessKeyId.value = parsed.accessKeyId?.trim() || ''
    accessKeySecret.value = parsed.accessKeySecret?.trim() || ''
    endpoint.value = parsed.endpoint?.trim() || ''
    bucket.value = parsed.bucket?.trim() || ''
    targetPath.value = parsed.targetPath?.trim() || ''
  } catch (error) {
    console.error('Failed to load OSS config', error)
  }
}

const persistOssConfig = () => {
  const payload = {
    accessKeyId: accessKeyId.value,
    accessKeySecret: accessKeySecret.value,
    endpoint: endpoint.value,
    bucket: bucket.value,
    targetPath: targetPath.value
  }
  localStorage.setItem(ossConfigStorageKey, JSON.stringify(payload))
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`
}

const normalizePath = (input: string) => {
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

const buildUploadKey = (relativePath: string) => {
  const prefix = normalizePath(targetPath.value)
  const cleanRelative = normalizePath(relativePath)
  if (!prefix) return cleanRelative
  if (!cleanRelative) return prefix
  return `${prefix}/${cleanRelative}`
}

const updateUploadKeys = () => {
  files.value = files.value.map((item) => ({
    ...item,
    uploadKey: buildUploadKey(item.relativePath)
  }))
}

const resetProgress = () => {
  overallPercent.value = 0
  overallLoaded.value = 0
  overallTotal.value = files.value.reduce((sum, file) => sum + file.size, 0)
  currentFile.value = ''
  files.value = files.value.map((item) => ({
    ...item,
    progress: 0,
    status: 'pending',
    message: undefined,
    uploadKey: buildUploadKey(item.relativePath)
  }))
}

const addUploadItems = (incoming: UploadItem[]) => {
  const existing = new Set(files.value.map((item) => `${item.path}|${item.relativePath}`))
  const merged = [...files.value]
  incoming.forEach((item) => {
    const key = `${item.path}|${item.relativePath}`
    if (!existing.has(key)) {
      existing.add(key)
      merged.push(item)
    }
  })
  files.value = merged
  updateUploadKeys()
}

const createUploadItemFromPath = (payload: {
  path: string
  name: string
  relativePath: string
  size: number
}): UploadItem => {
  return {
    id: crypto.randomUUID(),
    name: payload.name,
    path: payload.path,
    relativePath: payload.relativePath || payload.name,
    size: payload.size || 0,
    uploadKey: buildUploadKey(payload.relativePath || payload.name),
    progress: 0,
    status: 'pending'
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  if (isUploading.value) return

  const fileList = Array.from(event.dataTransfer?.files ?? [])
  if (fileList.length === 0) return

  const filePaths = fileList
    .map((file) => (file as File & { path?: string }).path)
    .filter((value): value is string => Boolean(value))

  if (filePaths.length !== fileList.length) {
    const items = Array.from(event.dataTransfer?.items ?? [])
    const hasDirectory = items.some((item) => {
      const entry = (
        item as DataTransferItem & { webkitGetAsEntry?: () => { isDirectory?: boolean } | null }
      ).webkitGetAsEntry?.()
      return Boolean(entry && entry.isDirectory)
    })
    const picked = hasDirectory
      ? await window.api.oss.selectFolder()
      : await window.api.oss.selectFiles()
    if (picked.length === 0) return
    addUploadItems(picked.map((file: any) => createUploadItemFromPath(file)))
    return
  }

  const commonRoot = getCommonRoot(filePaths)
  const items = fileList.map((file) => {
    const filePath = (file as File & { path?: string }).path || ''
    const name = file.name
    const size = file.size || 0
    const relativePath =
      file.webkitRelativePath || (commonRoot ? toRelativePath(filePath, commonRoot) : name)
    return createUploadItemFromPath({ path: filePath, name, relativePath, size })
  })
  addUploadItems(items)
}

const clearFiles = () => {
  if (isUploading.value) return
  files.value = []
  overallPercent.value = 0
  overallLoaded.value = 0
  overallTotal.value = 0
  currentFile.value = ''
}

const startUpload = async () => {
  if (!canUpload.value) return
  resetProgress()
  isUploading.value = true
  uploadTaskId.value = crypto.randomUUID()

  const payload = {
    taskId: uploadTaskId.value,
    config: {
      accessKeyId: accessKeyId.value.trim(),
      accessKeySecret: accessKeySecret.value.trim(),
      endpoint: endpoint.value.trim(),
      bucket: bucket.value.trim(),
      targetPath: targetPath.value.trim()
    },
    files: files.value.map((file) => ({
      path: file.path,
      name: file.name,
      relativePath: file.relativePath,
      size: file.size
    }))
  }

  try {
    await window.api.oss.upload(payload)
  } finally {
    isUploading.value = false
  }
}

const cancelUpload = async () => {
  if (!isUploading.value || !uploadTaskId.value) return
  await window.api.oss.cancelUpload({ taskId: uploadTaskId.value })
  isUploading.value = false
  currentFile.value = '已取消'
  files.value = files.value.map((item) =>
    item.status === 'success'
      ? item
      : {
          ...item,
          status: 'error',
          message: '已取消'
        }
  )
}

const triggerFileSelect = async () => {
  if (isUploading.value) return
  const picked = await window.api.oss.selectFiles()
  if (picked.length === 0) return
  addUploadItems(picked.map((file: any) => createUploadItemFromPath(file)))
}

const triggerFolderSelect = async () => {
  if (isUploading.value) return
  const picked = await window.api.oss.selectFolder()
  if (picked.length === 0) return
  addUploadItems(picked.map((file: any) => createUploadItemFromPath(file)))
}

const getCommonRoot = (paths: string[]) => {
  if (paths.length === 0) return ''
  const splitPaths = paths.map((item) => item.split(/[\\/]+/).slice(0, -1))
  const minLength = Math.min(...splitPaths.map((parts) => parts.length))
  const result: string[] = []
  for (let i = 0; i < minLength; i += 1) {
    const segment = splitPaths[0][i]
    if (splitPaths.every((parts) => parts[i] === segment)) {
      result.push(segment)
    } else {
      break
    }
  }
  return result.length > 0 ? result.join('\\') : ''
}

const toRelativePath = (filePath: string, root: string) => {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalizedRoot) return normalizedPath
  const prefix = normalizedRoot.endsWith('/') ? normalizedRoot : `${normalizedRoot}/`
  const relative = normalizedPath.startsWith(prefix)
    ? normalizedPath.slice(prefix.length)
    : normalizedPath
  return relative || normalizedPath
}

onMounted(() => {
  loadOssConfig()
  window.api.oss.onUploadProgress((progress) => {
    if (progress.taskId !== uploadTaskId.value) return
    overallPercent.value = progress.overallPercent
    overallLoaded.value = progress.overallLoaded
    overallTotal.value = progress.overallTotal
    currentFile.value = progress.fileName

    const target = files.value.find((item) => item.uploadKey === progress.relativePath)
    if (!target) return

    if (progress.status === 'uploading') {
      target.status = 'uploading'
      target.progress = progress.filePercent
    } else if (progress.status === 'done') {
      target.status = 'success'
      target.progress = 100
    } else {
      target.status = 'error'
      target.message = progress.message
    }
  })
})

watch(
  () => [
    accessKeyId.value,
    accessKeySecret.value,
    endpoint.value,
    bucket.value,
    targetPath.value
  ],
  persistOssConfig
)

onBeforeUnmount(() => {
  window.api.oss.removeUploadListener()
})
</script>

<template>
  <div class="oss-manager h-full flex flex-col p-6 overflow-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-[var(--color-text)] flex items-center gap-3">
        <svg
          class="w-7 h-7 text-[var(--color-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 15a4 4 0 014-4h1.5a4.5 4.5 0 018.9-.9A3.5 3.5 0 0118 18H7a4 4 0 01-4-3z"
          />
        </svg>
        阿里�?OSS 管理
      </h1>
      <p class="text-[var(--color-text-muted)] mt-2">
        配置 AccessKey �?Endpoint，拖拽文件或文件夹到上传区，默认对象权限�?public-read�?
      </p>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div class="xl:col-span-1 space-y-6">
        <div class="card-block">
          <div class="flex items-center gap-2 mb-4">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="text-sm font-medium text-[var(--color-text)]">OSS 连接配置</span>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-xs text-[var(--color-text-muted)]">Access Key ID</label>
              <input
                v-model="accessKeyId"
                :disabled="isUploading"
                type="text"
                placeholder="LTAIxxxxxxxxxxxx"
                class="input-field"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--color-text-muted)]">Access Key Secret</label>
              <input
                v-model="accessKeySecret"
                :disabled="isUploading"
                type="password"
                placeholder="********************************"
                class="input-field"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--color-text-muted)]">Endpoint</label>
              <input
                v-model="endpoint"
                :disabled="isUploading"
                type="text"
                placeholder="https://oss-cn-beijing.aliyuncs.com"
                class="input-field"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--color-text-muted)]">Bucket Name</label>
              <input
                v-model="bucket"
                :disabled="isUploading"
                type="text"
                placeholder="your-bucket-name"
                class="input-field"
              />
            </div>
          </div>
        </div>

        <div class="card-block">
          <div class="flex items-center gap-2 mb-4">
            <span class="w-2 h-2 rounded-full bg-blue-400"></span>
            <span class="text-sm font-medium text-[var(--color-text)]">上传路径与</span>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-xs text-[var(--color-text-muted)]">目标路径（可选）</label>
              <input
                v-model="targetPath"
                :disabled="isUploading"
                type="text"
                placeholder="例如: uploads/2026"
                class="input-field"
              />
              <p class="text-[11px] text-[var(--color-text-muted)] mt-1">
                当前目标路径: <span class="text-indigo-400">{{ displayTargetPath }}</span>
              </p>
            </div>
            <div
              class="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
            >
              <div>
                <p class="text-sm text-[var(--color-text)]">对象 ACL</p>
                <p class="text-xs text-[var(--color-text-muted)]">上传后默�?public-read</p>
              </div>
              <span class="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-300">
                public-read
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="xl:col-span-2 space-y-6">
        <div
          class="drop-zone"
          :class="{ dragging: isDragging, disabled: isUploading }"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <div class="flex flex-col items-center gap-3">
            <div class="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <svg
                class="w-7 h-7 text-indigo-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16l5-5 5 5M12 11v9"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 16.5a4.5 4.5 0 00-2.45-3.99A6 6 0 107 16.5"
                />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm text-[var(--color-text)]">拖拽文件或文件夹到此区域</p>
              <p class="text-xs text-[var(--color-text-muted)] mt-1">支持单文件或目录结构上传</p>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn-action" :disabled="isUploading" @click="triggerFileSelect">
                选择文件
              </button>
              <button class="btn-action" :disabled="isUploading" @click="triggerFolderSelect">
                选择文件夹
              </button>
            </div>
          </div>
        </div>

        <div class="card-block">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-purple-400"></span>
              <span class="text-sm font-medium text-[var(--color-text)]">待上传</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="btn-muted"
                :disabled="isUploading || files.length === 0"
                @click="clearFiles"
              >
                清空列表
              </button>
              <button class="btn-muted" :disabled="!isUploading" @click="cancelUpload">
                终止上传
              </button>
              <button class="btn-primary" :disabled="!canUpload" @click="startUpload">
                开始上传
              </button>
            </div>
          </div>

          <div v-if="files.length === 0" class="empty-state">暂无文件，请拖拽或选择文件</div>
          <div v-else class="space-y-3">
            <div
              v-for="file in files"
              :key="file.id"
              class="file-item"
              :class="{
                uploading: file.status === 'uploading',
                success: file.status === 'success',
                error: file.status === 'error'
              }"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-sm text-[var(--color-text)] truncate">{{ file.relativePath }}</p>
                  <p class="text-xs text-[var(--color-text-muted)] truncate">
                    目标路径: {{ file.uploadKey || file.relativePath }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-[var(--color-text-muted)]">{{ formatBytes(file.size) }}</p>
                  <p
                    class="text-xs"
                    :class="file.status === 'error' ? 'text-red-400' : 'text-indigo-300'"
                  >
                    {{
                      file.status === 'success'
                        ? '完成'
                        : file.status === 'error'
                          ? '失败'
                          : `${file.progress}%`
                    }}
                  </p>
                </div>
              </div>
              <div class="progress-track">
                <div class="progress-bar" :style="{ width: `${file.progress}%` }"></div>
              </div>
              <p v-if="file.status === 'error' && file.message" class="text-xs text-red-400 mt-1">
                {{ file.message }}
              </p>
            </div>
          </div>
        </div>

        <div class="card-block">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-[var(--color-text)]">上传进度</span>
            <span class="text-xs text-[var(--color-text-muted)]">{{ overallPercent }}%</span>
          </div>
          <div class="progress-track large">
            <div class="progress-bar" :style="{ width: `${overallPercent}%` }"></div>
          </div>
          <div
            class="flex items-center justify-between mt-2 text-xs text-[var(--color-text-muted)]"
          >
            <span>当前文件: {{ currentFile || '-' }}</span>
            <span>{{ formatBytes(overallLoaded) }} / {{ formatBytes(overallTotal) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oss-manager {
  background: linear-gradient(180deg, rgba(30, 30, 46, 0.95), rgba(20, 22, 34, 0.98));
}

.card-block {
  padding: 1.25rem;
  border-radius: 1rem;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.2);
}

.input-field {
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.6rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.input-field:focus {
  border-color: rgba(99, 102, 241, 0.6);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.input-field:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.drop-zone {
  border: 2px dashed rgba(99, 102, 241, 0.4);
  background: rgba(24, 26, 40, 0.6);
  padding: 2.5rem;
  border-radius: 1.25rem;
  transition: all 0.2s ease;
}

.drop-zone.dragging {
  border-color: rgba(99, 102, 241, 0.9);
  background: rgba(99, 102, 241, 0.15);
  transform: translateY(-2px);
}

.drop-zone.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-action {
  padding: 0.45rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.8rem;
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-text);
  border: 1px solid rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease;
}

.btn-action:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.3);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-muted {
  padding: 0.4rem 0.9rem;
  border-radius: 0.7rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  background: transparent;
}

.btn-muted:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.45rem 1.1rem;
  border-radius: 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  transition: transform 0.2s ease;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.empty-state {
  padding: 1.2rem;
  border-radius: 0.75rem;
  background: rgba(30, 30, 46, 0.6);
  border: 1px dashed var(--color-border);
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.file-item {
  padding: 0.85rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: rgba(26, 28, 42, 0.75);
}

.file-item.uploading {
  border-color: rgba(99, 102, 241, 0.4);
}

.file-item.success {
  border-color: rgba(16, 185, 129, 0.5);
}

.file-item.error {
  border-color: rgba(239, 68, 68, 0.5);
}

.progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-top: 0.5rem;
}

.progress-track.large {
  height: 8px;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #6366f1, #22d3ee);
  transition: width 0.2s ease;
}
</style>
