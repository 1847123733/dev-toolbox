/**
 * HTTP 请求服务
 * 在主进程中发送 HTTP 请求，绕过 CORS 限制，自动使用应用代理设置
 */
import { ipcMain, net } from 'electron'

interface RequestPayload {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  timeout?: number
}

export function setupHttpClient(): void {
  ipcMain.handle('http:send', async (_event, payload: RequestPayload) => {
    const startTime = Date.now()

    try {
      const { method, url, headers, body, timeout = 30000 } = payload

      // 验证 URL
      const parsedUrl = new URL(url)

      return await new Promise((resolve) => {
        const request = net.request({
          method,
          url: parsedUrl.toString()
        })

        // 设置请求头
        for (const [key, value] of Object.entries(headers)) {
          if (key && value) {
            request.setHeader(key, value)
          }
        }

        // 超时处理
        const timer = setTimeout(() => {
          request.abort()
          resolve({
            status: 0,
            statusText: 'Timeout',
            headers: {},
            body: '',
            size: 0,
            time: Date.now() - startTime,
            error: `请求超时 (${timeout / 1000}s)`
          })
        }, timeout)

        const chunks: Buffer[] = []

        request.on('response', (response) => {
          response.on('data', (chunk) => {
            chunks.push(chunk)
          })

          response.on('end', () => {
            clearTimeout(timer)
            const buffer = Buffer.concat(chunks)
            const responseBody = buffer.toString('utf-8')

            const responseHeaders: Record<string, string> = {}
            const rawHeaders = response.headers
            for (const [key, value] of Object.entries(rawHeaders)) {
              responseHeaders[key] = Array.isArray(value) ? value.join(', ') : (value as string)
            }

            resolve({
              status: response.statusCode,
              statusText: response.statusMessage || '',
              headers: responseHeaders,
              body: responseBody,
              size: buffer.length,
              time: Date.now() - startTime
            })
          })
        })

        request.on('error', (error) => {
          clearTimeout(timer)
          resolve({
            status: 0,
            statusText: 'Error',
            headers: {},
            body: '',
            size: 0,
            time: Date.now() - startTime,
            error: error.message
          })
        })

        // 发送请求体
        if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
          request.write(body)
        }
        request.end()
      })
    } catch (error) {
      return {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: '',
        size: 0,
        time: Date.now() - startTime,
        error: error instanceof Error ? error.message : '请求失败'
      }
    }
  })
}
