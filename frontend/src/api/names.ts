// 한국식 이름 후보를 서버(LLM)에서 받는다. 서버가 못 주면(503, 3초 초과, 통신 실패) 같은 자리에서 임시 규칙으로 대신한다.
import type { NameCandidate, NameGenerator } from '../core/types.ts'
import type { components } from './schema.d.ts'
import { ApiError, isRecord, type ApiClient } from './client.ts'

const NAME_TIMEOUT_MS = 3000

function parseCandidates(v: unknown): NameCandidate[] | null {
  if (!isRecord(v) || !Array.isArray(v.candidates) || v.candidates.length === 0) return null
  const out: NameCandidate[] = []
  for (const c of v.candidates as unknown[]) {
    if (!isRecord(c) || typeof c.name !== 'string' || !/^[가-힣]{1,10}$/.test(c.name)) return null
    out.push(typeof c.note === 'string' && c.note ? { name: c.name, note: c.note } : { name: c.name })
  }
  return out
}

/** 4xx(401 로그인 만료, 422 이름 확인)는 대신하지 않고 그대로 던진다. 나머지는 서버가 후보를 못 준 것 */
const serverCannotSuggest = (e: unknown) => e instanceof ApiError && !(e.status >= 400 && e.status < 500)

export function createApiNameGenerator(client: ApiClient, fallback: NameGenerator): NameGenerator {
  return async (fullName) => {
    const body: components['schemas']['NameSuggestRequest'] = { ja_name: fullName }
    try {
      return await client.request('POST', '/names/suggest', { body, parse: parseCandidates, timeoutMs: NAME_TIMEOUT_MS })
    } catch (e) {
      if (serverCannotSuggest(e)) return fallback(fullName)
      throw e
    }
  }
}
