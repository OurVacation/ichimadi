// 서버 저장. core/types.ts의 Store와 같은 모양이라 main.tsx에서 기기 저장 대신 끼운다.
// 사용자는 토큰으로만 식별하므로 accountId 인자는 쓰지 않는다.
import type { Animal, Profile, Stamp, Store } from '../core/types.ts'
import type { components } from './schema.d.ts'
import { ApiError, isRecord, type ApiClient } from './client.ts'

type Schemas = components['schemas']
const ANIMALS: readonly string[] = ['tiger', 'rabbit', 'magpie', 'bear'] satisfies Schemas['Animal'][]

function parseLogin(v: unknown): Schemas['LoginResponse'] | null {
  if (!isRecord(v)) return null
  const { access_token, account_id, expires_in } = v
  return typeof access_token === 'string' && access_token && typeof account_id === 'string' && account_id && typeof expires_in === 'number'
    ? { access_token, account_id, expires_in, token_type: 'bearer' }
    : null
}

function parseMe(v: unknown): Profile | null {
  if (!isRecord(v)) return null
  const { animal, korean_name } = v
  if (!(animal === null || (typeof animal === 'string' && ANIMALS.includes(animal)))) return null
  if (!(korean_name === null || typeof korean_name === 'string')) return null
  return { animal: animal as Animal | null, koreanName: korean_name }
}

function parseStamps(v: unknown): Stamp[] | null {
  if (!isRecord(v) || !Array.isArray(v.stamps)) return null
  const stamps: Stamp[] = []
  for (const s of v.stamps as unknown[]) {
    if (!isRecord(s) || typeof s.phrase_id !== 'string' || typeof s.stamped_at !== 'string') return null
    if (Number.isNaN(Date.parse(s.stamped_at))) return null
    stamps.push({ phraseId: s.phrase_id, at: s.stamped_at })
  }
  return stamps
}

export function createApiStore(client: ApiClient): Store {
  return {
    async login(id, password) {
      const body: Schemas['LoginRequest'] = { login_id: id, password }
      try {
        const r = await client.request('POST', '/auth/login', { body, parse: parseLogin, auth: false })
        client.saveAuth(r.access_token, r.account_id)
        return { accountId: r.account_id }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    getProfile: () => client.request('GET', '/me', { parse: parseMe }),
    async saveProfile(_accountId, profile) {
      const body: Schemas['ProfileRequest'] = { animal: profile.animal, korean_name: profile.koreanName }
      await client.request('PUT', '/me/profile', { body, parse: parseMe })
    },
    getStamps: () => client.request('GET', '/me/stamps', { parse: parseStamps }),
    // 받은 시각은 서버 시각이다 (보류 H-1). at은 보내지 않는다
    addStamp(_accountId, phraseId) {
      const body: Schemas['AddStampRequest'] = { phrase_id: phraseId }
      return client.request('POST', '/me/stamps', { body, parse: parseStamps })
    },
  }
}
