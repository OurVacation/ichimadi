import type { Profile, Stamp, Store, TrialAccount } from './types.ts'

export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * 기기 저장을 연다. 막혀 있으면(사파리 개인 정보 보호, 일부 앱 안 브라우저) 던지므로
 * 그때는 메모리에 둔다. 도장은 이 탭이 열려 있는 동안만 남는다.
 */
export function openStorage(device: () => KeyValueStorage): KeyValueStorage {
  try {
    const storage = device()
    const probe = 'ichimadi:probe'
    storage.setItem(probe, probe)
    storage.removeItem(probe)
    return storage
  } catch {
    const memory = new Map<string, string>()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    }
  }
}

const EMPTY_PROFILE: Profile = { animal: null, koreanName: null }

// 휴대폰 일본어 자판은 전각(ｊｕｄｇｅ０１, ４８２１)이나 끝 공백을 넣기 쉽다
const normalize = (s: string) => s.normalize('NFKC').trim()
const normalizeId = (id: string) => normalize(id).toLowerCase()

export function createLocalStore(storage: KeyValueStorage, accounts: TrialAccount[]): Store {
  const profileKey = (accountId: string) => `ichimadi:${accountId}:profile`
  const stampsKey = (accountId: string) => `ichimadi:${accountId}:stamps`

  function read<T>(key: string, fallback: T, parse: (value: unknown) => T | null): T {
    const raw = storage.getItem(key)
    if (raw === null) return fallback
    try {
      return parse(JSON.parse(raw)) ?? fallback
    } catch {
      return fallback
    }
  }

  const readStamps = (accountId: string) => read(stampsKey(accountId), [], parseStamps)

  return {
    async login(id, password) {
      const wanted = normalizeId(id)
      const given = normalize(password)
      const account = accounts.find((a) => normalizeId(a.id) === wanted && normalize(a.password) === given)
      return account ? { accountId: normalizeId(account.id) } : null
    },
    async getProfile(accountId) {
      return { ...read(profileKey(accountId), EMPTY_PROFILE, (v) => (isProfile(v) ? v : null)) }
    },
    async saveProfile(accountId, profile) {
      storage.setItem(profileKey(accountId), JSON.stringify(profile))
    },
    async getStamps(accountId) {
      return readStamps(accountId)
    },
    async addStamp(accountId, phraseId, at = new Date()) {
      const stamps = readStamps(accountId)
      if (stamps.some((s) => s.phraseId === phraseId)) return stamps
      const next = [...stamps, { phraseId, at: at.toISOString() }]
      storage.setItem(stampsKey(accountId), JSON.stringify(next))
      return next
    },
  }
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) return false
  const { animal, koreanName } = value as Record<string, unknown>
  return (
    (animal === null || ['tiger', 'rabbit', 'magpie', 'bear'].includes(animal as string)) &&
    (koreanName === null || typeof koreanName === 'string')
  )
}

/** 망가진 도장(시각이 날짜가 아닌 것 등)은 버리고 나머지만 읽는다. */
function parseStamps(value: unknown): Stamp[] | null {
  if (!Array.isArray(value)) return null
  return value.filter(
    (s): s is Stamp =>
      typeof s === 'object' &&
      s !== null &&
      typeof s.phraseId === 'string' &&
      typeof s.at === 'string' &&
      !Number.isNaN(Date.parse(s.at)),
  )
}
