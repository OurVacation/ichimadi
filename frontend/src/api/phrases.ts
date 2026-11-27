// 한마디는 서버에서 받는다 (GET /api/phrases). 받으면 기기에 남겨 두고, 서버에 닿지 못하면(통신 실패·시간 초과·5xx) 남겨 둔 것을 쓴다.
// 서버가 답했는데 404나 이상한 응답이면 남겨 둔 것도 믿지 않는다 (지우고 에러).
// 로그인 직후 한 번 받아 메모리에 두므로 카드는 네트워크를 기다리지 않는다.
import type { Phrase, PhraseSource } from '../core/types.ts'
import type { KeyValueStorage } from '../core/store.ts'
import type { components } from './schema.d.ts'
import { ApiError, isRecord, type ApiClient } from './client.ts'

type PhraseItem = components['schemas']['PhraseItem']

const PHRASE_ITEM_KEYS = ['id', 'label', 'ko', 'kana', 'ja', 'when', 'reply', 'reply_kana', 'reply_ja'] as const
const PHRASE_KEYS = ['id', 'label', 'ko', 'kana', 'ja', 'when', 'reply', 'replyKana', 'replyJa'] as const

const allText = <K extends string>(v: Record<string, unknown>, keys: readonly K[]) =>
  keys.every((k) => typeof v[k] === 'string' && (v[k] as string).trim() !== '')

const toPhrase = (p: PhraseItem): Phrase => ({
  id: p.id,
  label: p.label,
  ko: p.ko,
  kana: p.kana,
  ja: p.ja,
  when: p.when,
  reply: p.reply,
  replyKana: p.reply_kana,
  replyJa: p.reply_ja,
})

/** 한마디가 하나도 없거나 칸이 빈 것이 있으면 null (카드를 그릴 수 없다) */
function parsePhrases(v: unknown): Phrase[] | null {
  if (!isRecord(v) || !Array.isArray(v.phrases) || v.phrases.length === 0) return null
  const items = v.phrases as unknown[]
  return items.every((p) => isRecord(p) && allText(p, PHRASE_ITEM_KEYS)) ? (items as PhraseItem[]).map(toPhrase) : null
}

function parseCached(v: unknown): Phrase[] | null {
  if (!Array.isArray(v) || v.length === 0) return null
  return v.every((p) => isRecord(p) && allText(p, PHRASE_KEYS)) ? (v as Phrase[]) : null
}

export function createApiPhraseSource(client: ApiClient, storage: KeyValueStorage, setCode = 'hackathon'): PhraseSource {
  const cacheKey = `ichimadi:phrases:${setCode}`
  return async () => {
    try {
      const phrases = await client.request('GET', `/phrases?set_code=${encodeURIComponent(setCode)}`, { parse: parsePhrases })
      storage.setItem(cacheKey, JSON.stringify(phrases))
      return phrases
    } catch (e) {
      const answered = e instanceof ApiError && e.status !== 0 && e.status < 500
      if (answered) {
        if (e.status === 404 || e.code === 'bad_response') storage.removeItem(cacheKey)
        throw e
      }
      let cached: Phrase[] | null = null
      try {
        cached = parseCached(JSON.parse(storage.getItem(cacheKey) ?? 'null'))
      } catch {
        // 망가진 캐시는 없는 것과 같다
      }
      if (cached) return cached
      throw e
    }
  }
}
