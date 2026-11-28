// 「알아들었어요」의 도장은 화면에 먼저 찍고 서버 저장은 뒤에서 한다 (낙관적 UI).
// 아직 못 보낸 도장은 계정별로 기기에 모아 두고(ichimadi:<계정>:pendingStamps), 하나씩 다시 보낸다.
// 서버는 같은 도장을 여러 번 받아도 하나만 남기므로(첫 시각 유지) 다시 보내도 안전하다.
import type { KeyValueStorage } from '../core/store.ts'
import type { Stamp, Store } from '../core/types.ts'
import { ApiError, isRecord } from './client.ts'

/** 보낸 결과. synced: 서버가 준 도장 목록(아직 못 보낸 것 포함). dropped: 서버가 없는 한마디라고 해서(404) 버린 도장 */
export type OutboxEvent =
  | { kind: 'synced'; accountId: string; stamps: Stamp[] }
  | { kind: 'dropped'; accountId: string; phraseId: string; message: string }

export type StampOutbox = {
  /** 도장을 모아 두고 바로 보내기 시작한다. 같은 한마디는 한 번만 넣는다 */
  add(accountId: string, phraseId: string, at: Date): void
  /** 아직 못 보낸 도장 */
  pending(accountId: string): Stamp[]
  /** 모아 둔 것을 하나씩 보낸다. 통신이 안 되면 멈추고 남겨 둔다 */
  flush(accountId: string): Promise<void>
  /** 이 계정으로 들어왔다: 바로 보내고, 남은 게 있으면 30초마다·온라인이 되면 다시 보낸다 */
  start(accountId: string): void
  /** 로그아웃, 계정 바뀜: 다시 보내기를 멈춘다 (모아 둔 것은 지우지 않는다) */
  stop(): void
  subscribe(listener: (e: OutboxEvent) => void): () => void
}

export const RETRY_MS = 30_000

type Timers = { setInterval(fn: () => void, ms: number): unknown; clearInterval(id: unknown): void }

/** 서버 도장 목록에 아직 못 보낸 도장을 더한다 (같은 한마디는 서버 것을 쓴다) */
export function withPending(stamps: Stamp[], pending: Stamp[]): Stamp[] {
  const have = new Set(stamps.map((s) => s.phraseId))
  return [...stamps, ...pending.filter((p) => !have.has(p.phraseId))]
}

const browserOnline = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', listener)
  return () => window.removeEventListener('online', listener)
}

export function createStampOutbox({
  storage,
  send,
  currentAccount,
  onOnline = browserOnline,
  timers = globalThis,
}: {
  storage: KeyValueStorage
  /** 도장 하나를 저장하고 전체 도장 목록을 받는다 (Store.addStamp) */
  send: Store['addStamp']
  /** 지금 로그인한 계정. 다른 계정의 도장을 지금 토큰으로 보내지 않게 보내기 직전마다 확인한다 */
  currentAccount: () => string | null
  onOnline?: (listener: () => void) => () => void
  timers?: Timers
}): StampOutbox {
  const key = (accountId: string) => `ichimadi:${accountId}:pendingStamps`
  const listeners = new Set<(e: OutboxEvent) => void>()
  const running = new Map<string, Promise<void>>()
  let active: string | null = null
  let timer: unknown = null

  function read(accountId: string): Stamp[] {
    try {
      const v: unknown = JSON.parse(storage.getItem(key(accountId)) ?? '[]')
      if (!Array.isArray(v)) return []
      return v.filter(
        (s): s is Stamp => isRecord(s) && typeof s.phraseId === 'string' && typeof s.at === 'string' && !Number.isNaN(Date.parse(s.at)),
      )
    } catch {
      return []
    }
  }

  function write(accountId: string, list: Stamp[]) {
    if (list.length === 0) storage.removeItem(key(accountId))
    else storage.setItem(key(accountId), JSON.stringify(list))
  }

  const remove = (accountId: string, phraseId: string) => write(accountId, read(accountId).filter((s) => s.phraseId !== phraseId))
  const emit = (e: OutboxEvent) => listeners.forEach((l) => l(e))

  /** 남은 게 있는 동안만 30초 타이머를 둔다 */
  function schedule() {
    const want = active !== null && read(active).length > 0
    if (want && timer === null) {
      timer = timers.setInterval(() => {
        if (active) void flush(active)
      }, RETRY_MS)
    } else if (!want && timer !== null) {
      timers.clearInterval(timer)
      timer = null
    }
  }

  async function run(accountId: string) {
    try {
      while (currentAccount() === accountId) {
        const next = read(accountId)[0]
        if (!next) break
        try {
          const stamps = await send(accountId, next.phraseId, new Date(next.at))
          remove(accountId, next.phraseId)
          emit({ kind: 'synced', accountId, stamps: withPending(stamps, read(accountId)) })
        } catch (e) {
          // 없는 한마디(404)는 다시 보내도 안 된다. 나머지(통신, 시간 초과, 5xx, 401)는 남겨 두고 다음에
          if (!(e instanceof ApiError && e.status === 404)) break
          remove(accountId, next.phraseId)
          emit({ kind: 'dropped', accountId, phraseId: next.phraseId, message: e.messageJa })
        }
      }
    } finally {
      running.delete(accountId)
      schedule()
    }
  }

  function flush(accountId: string): Promise<void> {
    const now = running.get(accountId)
    if (now) return now
    if (currentAccount() !== accountId || read(accountId).length === 0) return Promise.resolve()
    const p = run(accountId)
    running.set(accountId, p)
    return p
  }

  onOnline(() => {
    if (active) void flush(active)
  })

  return {
    add(accountId, phraseId, at) {
      const list = read(accountId)
      if (!list.some((s) => s.phraseId === phraseId)) write(accountId, [...list, { phraseId, at: at.toISOString() }])
      schedule()
      void flush(accountId)
    },
    pending: read,
    flush,
    start(accountId) {
      active = accountId
      schedule()
      void flush(accountId)
    },
    stop() {
      active = null
      schedule()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
