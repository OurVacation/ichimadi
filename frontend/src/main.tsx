/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createApiClient } from './api/client.ts'
import { createApiNameGenerator } from './api/names.ts'
import { createApiPhraseSource } from './api/phrases.ts'
import { createApiStore } from './api/store.ts'
import { parseLoginHash } from './core/loginHash.ts'
import { temporaryNameGenerator } from './core/nameGenerator.ts'
import { openStorage, type KeyValueStorage } from './core/store.ts'
import type { NameGenerator, PhraseSource, Store } from './core/types.ts'
import { App, type Session } from './ui/App.tsx'
import './index.css'

export type Mode = { store: Store; session: Session; generateNames: NameGenerator; loadPhrases: PhraseSource }

/** 기본: 같은 출처의 /api. 로그인 토큰과 받은 한마디는 기기에 남긴다 */
function apiMode(storage: KeyValueStorage): Mode {
  const client = createApiClient({ fetch: (input, init) => fetch(input, init), storage })
  return {
    store: createApiStore(client),
    session: {
      load: () => client.accountId(),
      // 로그인할 때 토큰은 store가 저장한다. 여기서는 로그아웃만 한다
      save: (accountId) => {
        if (accountId === null) client.clearAuth()
      },
      onExpired: (listener) => client.onUnauthorized(listener),
    },
    generateNames: createApiNameGenerator(client, temporaryNameGenerator),
    loadPhrases: createApiPhraseSource(client, storage),
  }
}

const storage = openStorage(() => window.localStorage)
// 오프라인 시연 모드는 따로 불러온다. 서버 모드 빌드에서는 이 갈래가 통째로 빠진다
const mode: Promise<Mode> =
  import.meta.env.VITE_STORE === 'local'
    ? import('./localMode.ts').then((m) => m.localMode(storage))
    : Promise.resolve(apiMode(storage))

// QR 카드로 열면 주소 끝에 비밀번호가 있다. 읽은 즉시 주소에서 지운다 (성공·실패와 상관없이)
const qrLogin = parseLoginHash(window.location.hash)
if (qrLogin.kind !== 'none') history.replaceState(null, '', window.location.pathname + window.location.search)

mode.then((m) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App {...m} qrLogin={qrLogin} />
    </StrictMode>,
  ),
)
