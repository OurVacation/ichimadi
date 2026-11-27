/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { parseLoginHash } from './core/loginHash.ts'
import { temporaryNameGenerator } from './core/nameGenerator.ts'
import { createLocalStore, openStorage } from './core/store.ts'
import { TRIAL_ACCOUNTS } from './data/accounts.ts'
import { App } from './ui/App.tsx'
import './index.css'

const storage = openStorage(() => window.localStorage)
const store = createLocalStore(storage, TRIAL_ACCOUNTS)
const SESSION_KEY = 'ichimadi:session'
const session = {
  load: () => {
    try {
      const saved = storage.getItem(SESSION_KEY)
      return TRIAL_ACCOUNTS.some((a) => a.id === saved) ? saved : null
    } catch {
      return null
    }
  },
  save: (accountId: string | null) => {
    try {
      if (accountId) storage.setItem(SESSION_KEY, accountId)
      else storage.removeItem(SESSION_KEY)
    } catch {
      // 저장을 못 하면 새로고침 뒤 다시 로그인하면 된다
    }
  },
}

// QR 카드로 열면 주소 끝에 비밀번호가 있다. 읽은 즉시 주소에서 지운다 (성공·실패와 상관없이)
const qrLogin = parseLoginHash(window.location.hash)
if (qrLogin.kind !== 'none') history.replaceState(null, '', window.location.pathname + window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} session={session} qrLogin={qrLogin} generateNames={temporaryNameGenerator} />
  </StrictMode>,
)
