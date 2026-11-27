// 화면 흐름. 지금 어느 화면인지는 이 상태 하나가 정한다. 저장은 App이 Store로 하고 결과만 이벤트로 넣는다.
import type { FirstScreen, Phrase, Profile, Stamp } from '../core/types.ts'
import { firstScreen } from '../core/session.ts'
import { bookProgress } from '../core/stamps.ts'
import { PHRASES } from '../data/phrases.ts'

export type Screen =
  | { kind: 'animal' }
  | { kind: 'name' }
  | { kind: 'board' }
  | { kind: 'opening'; phrase: Phrase }
  | { kind: 'card'; phrase: Phrase }
  | { kind: 'partner'; phrase: Phrase }
  | { kind: 'stamped'; phrase: Phrase }
  | { kind: 'book'; closed: boolean }

export type Session = { accountId: string; profile: Profile; stamps: Stamp[]; screen: Screen }

/** null이면 로그인 화면 */
export type State = Session | null

export type Event =
  | { type: 'signedIn'; accountId: string; profile: Profile; stamps: Stamp[]; first: FirstScreen }
  | { type: 'profileSaved'; profile: Profile }
  | { type: 'reselectAnimal' }
  | { type: 'openPouch'; phrase: Phrase; instant: boolean }
  | { type: 'pouchOpened' }
  | { type: 'said' }
  | { type: 'again' }
  | { type: 'stamped'; stamps: Stamp[] }
  | { type: 'toBoard' }
  | { type: 'toBook' }
  | { type: 'closeBook' }
  | { type: 'openBook' }
  | { type: 'signOut' }

/** 지금 화면에서 받을 수 없는 이벤트는 무시하고 같은 상태를 돌려준다. */
export function reduce(state: State, e: Event): State {
  if (e.type === 'signedIn') {
    return { accountId: e.accountId, profile: e.profile, stamps: e.stamps, screen: { kind: e.first } }
  }
  if (!state) return state
  if (e.type === 'signOut') return null
  const s = state.screen
  const go = (screen: Screen): State => ({ ...state, screen })

  switch (e.type) {
    case 'profileSaved':
      return s.kind === 'animal' || s.kind === 'name'
        ? { ...state, profile: e.profile, screen: { kind: firstScreen(e.profile) } }
        : state
    case 'reselectAnimal':
      return s.kind === 'name' ? go({ kind: 'animal' }) : state
    case 'openPouch':
      if (s.kind !== 'board') return state
      return go(e.instant ? { kind: 'card', phrase: e.phrase } : { kind: 'opening', phrase: e.phrase })
    case 'pouchOpened':
      return s.kind === 'opening' ? go({ kind: 'card', phrase: s.phrase }) : state
    case 'said':
      return s.kind === 'card' ? go({ kind: 'partner', phrase: s.phrase }) : state
    case 'again':
      return s.kind === 'partner' ? go({ kind: 'card', phrase: s.phrase }) : state
    case 'stamped':
      return s.kind === 'partner' ? { ...state, stamps: e.stamps, screen: { kind: 'stamped', phrase: s.phrase } } : state
    case 'toBoard':
      return s.kind === 'card' || s.kind === 'stamped' || s.kind === 'book' ? go({ kind: 'board' }) : state
    case 'toBook':
      return s.kind === 'board' || s.kind === 'stamped' ? go({ kind: 'book', closed: false }) : state
    case 'closeBook':
      return s.kind === 'book' && bookProgress(state.stamps, PHRASES).complete ? go({ kind: 'book', closed: true }) : state
    case 'openBook':
      return s.kind === 'book' ? go({ kind: 'book', closed: false }) : state
  }
}
