/**
 * 阿里云 OSS 上传服务
 * 使用 ali-oss SDK
 */
import { dialog, ipcMain } from 'electron'
import OSS from 'ali-oss'
import { readdir, stat } from 'fs/promises'
import { basename, join, relative } from 'path'
import { URL } from 'url'
import { notify } from './notification'

type UploadStatus = 'uploading' | 'done' | 'error'

interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  endpoint: string
  bucket: string
  targetPath?: string
  acl?: 'public-read' | 'private' | 'public-read-write'
}

interface UploadFile {
  path: string
  name?: string
  relativePath?: string
  size?: number
}

interface UploadPayload {
  taskId: string
  config: OssConfig
  files: UploadFile[]
}

interface UploadProgress {
  taskId: string
  fileIndex: number
  fileName: string
  relativePath: string
  fileLoaded: number
  fileTotal: number
  filePercent: number
  overallLoaded: number
  overallTotal: number
  overallPercent: number
  status: UploadStatus
  message?: string
}

class UploadFailure extends Error {
  uploadedBytes: number
  totalBytes: number

  constructor(message: string, uploadedBytes: number, totalBytes: number) {
    super(message)
    this.uploadedBytes = uploadedBytes
    this.totalBytes = totalBytes
  }
}

class UploadCancelled extends UploadFailure {}

const activeTasks = new Map<
  string,
  {
    client: OSS
    cancelled: boolean
    current?: {
      objectKey: string
      uploadId?: string
    }
  }
>()

function normalizePath(input?: string): string {
  if (!input) return ''
  return input.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function parseEndpointConfig(endpoint: string, bucket: string): {
  host: string
  secure: boolean
  region?: string
  isAliyun: boolean
} {
  const clean = endpoint.trim()
  if (!clean) {
    throw new Error('请填写 Endpoint')
  }
  const withProtocol = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
  const url = new URL(withProtocol)
  let host = url.hostname
  const bucketPrefix = `${bucket}.`
  if (host.toLowerCase().startsWith(bucketPrefix.toLowerCase())) {
    host = host.slice(bucketPrefix.length)
  }
  const regionMatch = host.match(/oss-[^./]+/i)
  return {
    host,
    secure: url.protocol === 'https:',
    region: regionMatch ? regionMatch[0] : undefined,
    isAliyun: host.includes('aliyuncs.com')
  }
}

function buildOssClient(config: OssConfig): OSS {
  const endpointInfo = parseEndpointConfig(config.endpoint, config.bucket)
  const options: OSS.Options = {
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: endpointInfo.secure
  }

  if (endpointInfo.region) {
    options.region = endpointInfo.region
  } else {
    options.endpoint = endpointInfo.host
  }

  if (!endpointInfo.isAliyun && !endpointInfo.region) {
    options.cname = true
  }

  return new OSS(options)
}

async function buildUploadFileFromPath(filePath: string, root?: string): Promise<UploadFile> {
  const stats = await stat(filePath)
  const name = basename(filePath)
  const relativePath = root ? normalizePath(relative(root, filePath)) : name
  return { path: filePath, name, relativePath, size: stats.size }
}

async function collectFilesFromDirectory(root: string, currentDir: string): Promise<UploadFile[]> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const results: UploadFile[] = []
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await collectFilesFromDirectory(root, fullPath)))
    } else if (entry.isFile()) {
      results.push(await buildUploadFileFromPath(fullPath, root))
    }
  }
  return results
}

function buildObjectKey(targetPath: string | undefined, relativePath: string): string {
  const prefix = normalizePath(targetPath)
  const cleanRelative = normalizePath(relativePath)
  if (!prefix) return cleanRelative
  if (!cleanRelative) return prefix
  return `${prefix}/${cleanRelative}`
}

async function ensureFileSize(file: UploadFile): Promise<number> {
  if (typeof file.size === 'number' && Number.isFinite(file.size)) {
    return file.size
  }
  const stats = await stat(file.path)
  return stats.size
}

function getFileLabel(file: UploadFile): string {
  if (file.relativePath && file.relativePath.trim()) return file.relativePath
  if (file.name && file.name.trim()) return file.name
  return file.path
}

function getFallbackName(file: UploadFile): string {
  if (file.name && file.name.trim()) return file.name
  const parts = file.path ? file.path.split(/[\\/]/) : []
  return parts.length > 0 ? parts[parts.length - 1] : 'file'
}

function extractErrorMessage(error: unknown): string {
  if (!error) return '上传失败'
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const code = (error as { code?: string }).code
    return code ? `${code}: ${error.message}` : error.message
  }
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message || '上传失败')
  }
  return '上传失败'
}

async function uploadSingleFile(params: {
  client: OSS
  config: OssConfig
  file: UploadFile
  fileIndex: number
  totalBytes: number
  overallLoadedRef: { value: number }
  onProgress: (progress: UploadProgress) => void
  taskId: string
  task: {
    client: OSS
    cancelled: boolean
    current?: {
      objectKey: string
      uploadId?: string
    }
  }
}): Promise<void> {
  const { client, config, file, fileIndex, totalBytes, overallLoadedRef, onProgress, taskId, task } =
    params
  const fileSize = await ensureFileSize(file)
  const fileLabel = getFileLabel(file)
  const objectKey = buildObjectKey(
    config.targetPath,
    file.relativePath || file.name || getFallbackName(file)
  )
  const acl = config.acl || 'public-read'

  let fileLoaded = 0
  let lastLoaded = 0
  let lastEmitAt = 0

  if (task.cancelled) {
    throw new UploadCancelled('已取消上传', fileLoaded, fileSize)
  }

  task.current = { objectKey }

  const emitProgress = (status: UploadStatus, message?: string) => {
    const now = Date.now()
    if (status !== 'uploading' || now - lastEmitAt > 80) {
      lastEmitAt = now
      const filePercent = fileSize === 0 ? 100 : Math.round((fileLoaded / fileSize) * 100)
      const overallPercent =
        totalBytes === 0 ? 100 : Math.min(100, Math.round((overallLoadedRef.value / totalBytes) * 100))
      onProgress({
        taskId,
        fileIndex,
        fileName: fileLabel,
        relativePath: objectKey,
        fileLoaded,
        fileTotal: fileSize,
        filePercent,
        overallLoaded: overallLoadedRef.value,
        overallTotal: totalBytes,
        overallPercent,
        status,
        message
      })
    }
  }

  const updateLoaded = (loaded: number) => {
    const safeLoaded = Math.min(fileSize, Math.max(0, loaded))
    const delta = safeLoaded - lastLoaded
    if (delta > 0) {
      overallLoadedRef.value += delta
      lastLoaded = safeLoaded
      fileLoaded = safeLoaded
      emitProgress('uploading')
    }
  }

  emitProgress('uploading')

  try {
    await client.multipartUpload(objectKey, file.path, {
      headers: { 'x-oss-object-acl': acl },
      partSize: 5 * 1024 * 1024,
      parallel: 4,
      progress: async (percentage: number, checkpoint) => {
        if (checkpoint?.uploadId) {
          task.current = { objectKey, uploadId: checkpoint.uploadId }
        }
        updateLoaded(Math.round(fileSize * percentage))
        if (task.cancelled && checkpoint?.uploadId) {
          await client.abortMultipartUpload(objectKey, checkpoint.uploadId)
          throw new UploadCancelled('已取消上传', fileLoaded, fileSize)
        }
      }
    })
  } catch (error) {
    const message = extractErrorMessage(error)
    if (error instanceof UploadCancelled) {
      throw error
    }
    throw new UploadFailure(message, fileLoaded, fileSize)
  }

  if (fileSize > lastLoaded) {
    updateLoaded(fileSize)
  }
  emitProgress('done')
}

export function setupOssManager(): void {
  ipcMain.handle('oss:cancelUpload', async (_, payload: { taskId: string }) => {
    const task = activeTasks.get(payload.taskId)
    if (!task) {
      return { success: false, error: '任务不存在或已结束' }
    }
    task.cancelled = true
    if (task.current?.uploadId) {
      try {
        await task.client.abortMultipartUpload(task.current.objectKey, task.current.uploadId)
      } catch (error) {
        return { success: false, error: extractErrorMessage(error) }
      }
    }
    return { success: true }
  })

  ipcMain.handle('oss:selectFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return []
    }
    return await Promise.all(result.filePaths.map((filePath) => buildUploadFileFromPath(filePath)))
  })

  ipcMain.handle('oss:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return []
    }
    const root = result.filePaths[0]
    return await collectFilesFromDirectory(root, root)
  })

  ipcMain.handle('oss:upload', async (event, payload: UploadPayload) => {
    try {
      if (!payload || !payload.config) {
        notify.error('OSS 配置缺失')
        return { success: false, error: 'OSS 配置缺失' }
      }

      const { accessKeyId, accessKeySecret, endpoint, bucket } = payload.config
      if (!accessKeyId || !accessKeySecret || !endpoint || !bucket) {
        notify.error('请完整填写 OSS 连接配置')
        return { success: false, error: '请完整填写 OSS 连接配置' }
      }

      if (!payload.files || payload.files.length === 0) {
        notify.error('请先拖拽或选择文件/文件夹')
        return { success: false, error: '未选择文件' }
      }

      const client = buildOssClient(payload.config)
      const task = { client, cancelled: false }
      activeTasks.set(payload.taskId, task)
      const filesWithSize = await Promise.all(
        payload.files.map(async (file) => ({
          ...file,
          size: await ensureFileSize(file)
        }))
      )
      const totalBytes = filesWithSize.reduce((sum, file) => sum + (file.size || 0), 0)
      const overallLoadedRef = { value: 0 }
      const errors: { file: string; message: string }[] = []

      for (let i = 0; i < filesWithSize.length; i += 1) {
        if (task.cancelled) {
          const message = '已取消上传'
          notify.warning(message)
          activeTasks.delete(payload.taskId)
          return { success: false, error: message }
        }
        const file = filesWithSize[i]
        try {
          await uploadSingleFile({
            client,
            config: payload.config,
            file,
            fileIndex: i,
            totalBytes,
            overallLoadedRef,
            taskId: payload.taskId,
            task,
            onProgress: (progress) => {
              event.sender.send('oss:uploadProgress', progress)
            }
          })
        } catch (error) {
          const message =
            error instanceof UploadFailure || error instanceof UploadCancelled
              ? error.message
              : extractErrorMessage(error)
          const uploadedBytes = error instanceof UploadFailure ? error.uploadedBytes : 0
          const fileTotal = file.size || 0
          const fileLoaded = Math.min(uploadedBytes, fileTotal)
          const filePercent = fileTotal === 0 ? 0 : Math.round((fileLoaded / fileTotal) * 100)

          errors.push({ file: getFileLabel(file), message })
          event.sender.send('oss:uploadProgress', {
            taskId: payload.taskId,
            fileIndex: i,
            fileName: getFileLabel(file),
            relativePath: buildObjectKey(
              payload.config.targetPath,
              file.relativePath || file.name || getFallbackName(file)
            ),
            fileLoaded,
            fileTotal,
            filePercent,
            overallLoaded: overallLoadedRef.value,
            overallTotal: totalBytes,
            overallPercent:
              totalBytes === 0
                ? 0
                : Math.min(100, Math.round((overallLoadedRef.value / totalBytes) * 100)),
            status: 'error',
            message
          })
          notify.error(`上传失败: ${getFileLabel(file)} - ${message}`)
          activeTasks.delete(payload.taskId)
          return { success: false, error: message }
        }
      }

      notify.success(`上传完成，共 ${filesWithSize.length} 个对象`)
      activeTasks.delete(payload.taskId)
      return {
        success: errors.length === 0,
        uploaded: filesWithSize.length - errors.length,
        failed: errors.length,
        errors
      }
    } catch (error) {
      const message = extractErrorMessage(error)
      notify.error(message)
      activeTasks.delete(payload.taskId)
      return { success: false, error: message }
    }
  })
}
