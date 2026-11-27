// VITE_STORE=local: 오프라인 시연용. 기기 저장 + .env.local의 체험 계정 + content/phrases.json.
// main.tsx가 이 모드일 때만 불러오므로 서버 모드 번들에는 체험 계정과 한마디가 들어가지 않는다.
import { temporaryNameGenerator } from './core/nameGenerator.ts'
import { createLocalStore, type KeyValueStorage } from './core/store.ts'
import { TRIAL_ACCOUNTS } from './data/accounts.ts'
import { PHRASES } from './data/phrases.ts'
import type { Mode } from './main.tsx'

const SESSION_KEY = 'ichimadi:session'

export function localMode(storage: KeyValueStorage): Mode {
  return {
    store: createLocalStore(storage, TRIAL_ACCOUNTS),
    session: {
      load: () => {
        try {
          const saved = storage.getItem(SESSION_KEY)
          return TRIAL_ACCOUNTS.some((a) => a.id === saved) ? saved : null
        } catch {
          return null
        }
      },
      save: (accountId) => {
        try {
          if (accountId) storage.setItem(SESSION_KEY, accountId)
          else storage.removeItem(SESSION_KEY)
        } catch {
          // 저장을 못 하면 새로고침 뒤 다시 로그인하면 된다
        }
      },
    },
    generateNames: temporaryNameGenerator,
    loadPhrases: async () => PHRASES,
  }
}
