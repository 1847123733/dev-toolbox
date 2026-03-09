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
  <div class="oss-page">
    <div class="page-header">
      <h1 class="page-title">阿里云 OSS 管理</h1>
      <p class="page-desc">配置 AccessKey 与 Endpoint，拖拽文件或文件夹上传，默认对象权限为 public-read</p>
    </div>

    <div class="page-body">
      <div class="oss-layout">
        <!-- Left: Config -->
        <div class="config-col">
          <div class="config-card">
            <div class="card-label">
              <span class="label-dot green"></span>
              <span>OSS 连接配置</span>
            </div>
            <div class="config-fields">
              <div class="field">
                <label class="field-label">Access Key ID</label>
                <input v-model="accessKeyId" :disabled="isUploading" type="text" placeholder="LTAIxxxxxxxxxxxx" class="field-input" />
              </div>
              <div class="field">
                <label class="field-label">Access Key Secret</label>
                <input v-model="accessKeySecret" :disabled="isUploading" type="password" placeholder="********************************" class="field-input" />
              </div>
              <div class="field">
                <label class="field-label">Endpoint</label>
                <input v-model="endpoint" :disabled="isUploading" type="text" placeholder="https://oss-cn-beijing.aliyuncs.com" class="field-input" />
              </div>
              <div class="field">
                <label class="field-label">Bucket Name</label>
                <input v-model="bucket" :disabled="isUploading" type="text" placeholder="your-bucket-name" class="field-input" />
              </div>
            </div>
          </div>

          <div class="config-card">
            <div class="card-label">
              <span class="label-dot blue"></span>
              <span>上传路径</span>
            </div>
            <div class="config-fields">
              <div class="field">
                <label class="field-label">目标路径（可选）</label>
                <input v-model="targetPath" :disabled="isUploading" type="text" placeholder="例如: uploads/2026" class="field-input" />
                <p class="field-hint">当前目标路径: <span class="hint-highlight">{{ displayTargetPath }}</span></p>
              </div>
              <div class="acl-row">
                <div>
                  <p class="acl-title">对象 ACL</p>
                  <p class="acl-desc">上传后默认 public-read</p>
                </div>
                <span class="acl-badge">public-read</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Upload -->
        <div class="upload-col">
          <div
            class="drop-zone"
            :class="{ dragging: isDragging, disabled: isUploading }"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <div class="drop-content">
              <div class="drop-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 16l5-5 5 5M12 11v9" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 16.5a4.5 4.5 0 00-2.45-3.99A6 6 0 107 16.5" />
                </svg>
              </div>
              <p class="drop-text">拖拽文件或文件夹到此区域</p>
              <p class="drop-hint">支持单文件或目录结构上传</p>
              <div class="drop-actions">
                <button class="action-btn" :disabled="isUploading" @click="triggerFileSelect">选择文件</button>
                <button class="action-btn" :disabled="isUploading" @click="triggerFolderSelect">选择文件夹</button>
              </div>
            </div>
          </div>

          <div class="config-card">
            <div class="card-header-row">
              <div class="card-label">
                <span class="label-dot purple"></span>
                <span>待上传</span>
              </div>
              <div class="header-actions">
                <button class="ghost-btn" :disabled="isUploading || files.length === 0" @click="clearFiles">清空列表</button>
                <button class="ghost-btn" :disabled="!isUploading" @click="cancelUpload">终止上传</button>
                <button class="primary-btn" :disabled="!canUpload" @click="startUpload">开始上传</button>
              </div>
            </div>

            <div v-if="files.length === 0" class="empty-files">暂无文件，请拖拽或选择文件</div>
            <div v-else class="file-list">
              <div
                v-for="file in files"
                :key="file.id"
                class="file-item"
                :class="file.status"
              >
                <div class="file-info">
                  <div class="file-left">
                    <p class="file-name">{{ file.relativePath }}</p>
                    <p class="file-path">目标路径: {{ file.uploadKey || file.relativePath }}</p>
                  </div>
                  <div class="file-right">
                    <p class="file-size">{{ formatBytes(file.size) }}</p>
                    <p class="file-status" :class="file.status">
                      {{ file.status === 'success' ? '完成' : file.status === 'error' ? '失败' : `${file.progress}%` }}
                    </p>
                  </div>
                </div>
                <div class="progress-track">
                  <div class="progress-bar" :style="{ width: `${file.progress}%` }"></div>
                </div>
                <p v-if="file.status === 'error' && file.message" class="file-error">{{ file.message }}</p>
              </div>
            </div>
          </div>

          <div class="config-card">
            <div class="progress-header">
              <span class="progress-label">上传进度</span>
              <span class="progress-percent">{{ overallPercent }}%</span>
            </div>
            <div class="progress-track large">
              <div class="progress-bar" :style="{ width: `${overallPercent}%` }"></div>
            </div>
            <div class="progress-footer">
              <span>当前文件: {{ currentFile || '-' }}</span>
              <span>{{ formatBytes(overallLoaded) }} / {{ formatBytes(overallTotal) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oss-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.page-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.page-desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.page-body {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

.oss-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
}

@media (max-width: 960px) {
  .oss-layout {
    grid-template-columns: 1fr;
  }
}

.config-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-card {
  padding: 18px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
}

.card-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 14px;
}

.label-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.label-dot.green { background: #34d399; }
.label-dot.blue { background: #60a5fa; }
.label-dot.purple { background: #a78bfa; }

.config-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-label {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
  display: block;
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field-input:focus {
  border-color: rgba(129, 140, 248, 0.5);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.1);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.field-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.hint-highlight {
  color: var(--color-primary);
}

.acl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.acl-title {
  font-size: 13px;
  color: var(--color-text);
}

.acl-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.acl-badge {
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
}

/* Drop Zone */
.drop-zone {
  border: 2px dashed rgba(129, 140, 248, 0.25);
  background: rgba(23, 25, 35, 0.5);
  padding: 32px;
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.drop-zone.dragging {
  border-color: var(--color-primary);
  background: rgba(129, 140, 248, 0.08);
}

.drop-zone.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.drop-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: rgba(129, 140, 248, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-icon svg {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  opacity: 0.7;
}

.drop-text {
  font-size: 14px;
  color: var(--color-text);
}

.drop-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.drop-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.action-btn {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: rgba(129, 140, 248, 0.1);
  color: var(--color-text);
  border: 1px solid rgba(129, 140, 248, 0.25);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  background: rgba(129, 140, 248, 0.2);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Card Header Row */
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-header-row .card-label {
  margin-bottom: 0;
}

.header-actions {
  display: flex;
  gap: 6px;
}

.ghost-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ghost-btn:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-border-hover);
}

.ghost-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.primary-btn {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.primary-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.primary-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* File List */
.empty-files {
  padding: 20px;
  border-radius: var(--radius-sm);
  background: rgba(15, 17, 23, 0.5);
  border: 1px dashed var(--color-border);
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: rgba(15, 17, 23, 0.5);
}

.file-item.uploading { border-color: rgba(129, 140, 248, 0.3); }
.file-item.success { border-color: rgba(52, 211, 153, 0.3); }
.file-item.error { border-color: rgba(248, 113, 113, 0.3); }

.file-info {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.file-left { min-width: 0; }

.file-name {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  font-size: 11px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-right { text-align: right; flex-shrink: 0; }

.file-size {
  font-size: 11px;
  color: var(--color-text-muted);
}

.file-status {
  font-size: 11px;
  color: var(--color-primary);
}

.file-status.error { color: #f87171; }
.file-status.success { color: #34d399; }

.file-error {
  font-size: 11px;
  color: #f87171;
  margin-top: 4px;
}

/* Progress */
.progress-track {
  width: 100%;
  height: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  margin-top: 8px;
}

.progress-track.large {
  height: 6px;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  transition: width 0.2s ease;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.progress-percent {
  font-size: 12px;
  color: var(--color-text-muted);
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
