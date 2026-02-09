export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type BodyType = 'none' | 'json' | 'form' | 'text'

export interface HttpRequest {
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  bodyType: BodyType
  body: string
  formData: KeyValuePair[]
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number
  time: number
  error?: string
}

export interface HistoryItem {
  id: string
  request: HttpRequest
  response: HttpResponse
  timestamp: number
}
