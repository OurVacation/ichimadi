// 서버 호출은 모두 여기를 지난다. 같은 출처의 /api, JSON, Bearer 토큰, 시간 제한.
// 실패는 모두 ApiError 하나로 바꾼다. 서버 에러는 {code, message_ja}, 통신 실패는 status 0.
import type { KeyValueStorage } from '../core/store.ts'
import type { components } from './schema.d.ts'
import { JA } from '../i18n.ts'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly messageJa: string
  constructor(status: number, code: string, messageJa: string) {
    super(`${status} ${code}`)
    this.status = status
    this.code = code
    this.messageJa = messageJa
  }
}

/** 응답 본문을 확인해 쓸 모양으로 바꾼다. 모양이 다르면 null */
export type Parse<T> = (body: unknown) => T | null

export type RequestOptions<T> = {
  body?: unknown
  parse: Parse<T>
  timeoutMs?: number
  /** false면 토큰을 보내지 않는다 (로그인) */
  auth?: boolean
}

export type ApiClient = {
  request<T>(method: 'GET' | 'POST' | 'PUT', path: string, options: RequestOptions<T>): Promise<T>
  /** 로그인한 계정. 토큰과 같이 저장소에 남아 새로고침 뒤에도 유지된다 */
  accountId(): string | null
  saveAuth(token: string, accountId: string): void
  clearAuth(): void
  /** 토큰을 보낸 요청이 401이면 토큰을 지운 뒤 부른다. 돌려준 함수로 해제 */
  onUnauthorized(listener: () => void): () => void
}

const AUTH_KEY = 'ichimadi:auth'
const DEFAULT_TIMEOUT_MS = 8000

type Auth = { token: string; accountId: string }

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readAuth(storage: KeyValueStorage): Auth | null {
  try {
    const v: unknown = JSON.parse(storage.getItem(AUTH_KEY) ?? 'null')
    return isRecord(v) && typeof v.token === 'string' && typeof v.accountId === 'string' && v.token && v.accountId
      ? { token: v.token, accountId: v.accountId }
      : null
  } catch {
    return null
  }
}

function errorBody(body: unknown): components['schemas']['ErrorResponse'] | null {
  return isRecord(body) && typeof body.code === 'string' && typeof body.message_ja === 'string'
    ? { code: body.code, message_ja: body.message_ja }
    : null
}

export function createApiClient({
  fetch,
  storage,
  baseUrl = '/api',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  fetch: typeof globalThis.fetch
  storage: KeyValueStorage
  baseUrl?: string
  timeoutMs?: number
}): ApiClient {
  let auth = readAuth(storage)
  const listeners = new Set<() => void>()

  function clearAuth() {
    auth = null
    storage.removeItem(AUTH_KEY)
  }

  async function request<T>(method: string, path: string, options: RequestOptions<T>): Promise<T> {
    const token = options.auth === false ? null : (auth?.token ?? null)
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs)
    let status = 0
    let body: unknown
    try {
      const res = await fetch(baseUrl + path, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
      status = res.status
      const text = await res.text()
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = undefined
      }
      if (!res.ok) {
        if (status === 401 && token) {
          clearAuth()
          for (const listener of listeners) listener()
        }
        const err = errorBody(body)
        throw err ? new ApiError(status, err.code, err.message_ja) : new ApiError(status, 'http_error', JA.error)
      }
    } catch (e) {
      if (e instanceof ApiError) throw e
      if (controller.signal.aborted) throw new ApiError(0, 'timeout', JA.network.timeout)
      throw new ApiError(status, 'network_error', JA.network.offline)
    } finally {
      clearTimeout(timer)
    }
    const parsed = options.parse(body)
    if (parsed === null) throw new ApiError(status, 'bad_response', JA.error)
    return parsed
  }

  return {
    request,
    accountId: () => auth?.accountId ?? null,
    saveAuth(token, accountId) {
      auth = { token, accountId }
      storage.setItem(AUTH_KEY, JSON.stringify(auth))
    },
    clearAuth,
    onUnauthorized(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
