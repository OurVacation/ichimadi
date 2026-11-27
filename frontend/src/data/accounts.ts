// 백엔드 로그인이 붙기 전까지 쓰는 체험 계정 (A-01).
// 비밀번호는 커밋하지 않는다. VITE_TRIAL_ACCOUNTS("아이디:비밀번호,아이디:비밀번호")를 .env.local에 둔다.
import type { TrialAccount } from '../core/types.ts'

export function parseTrialAccounts(raw: string | undefined): TrialAccount[] {
  const seen = new Set<string>()
  const accounts: TrialAccount[] = []
  for (const part of (raw ?? '').split(',')) {
    const i = part.indexOf(':')
    if (i <= 0) continue
    const id = part.slice(0, i).trim()
    const password = part.slice(i + 1).trim()
    if (!id || !password || seen.has(id)) continue
    seen.add(id)
    accounts.push({ id, password })
  }
  return accounts
}

const env = (import.meta as { env?: Record<string, string | undefined> }).env
export const TRIAL_ACCOUNTS: TrialAccount[] = parseTrialAccounts(env?.VITE_TRIAL_ACCOUNTS)
