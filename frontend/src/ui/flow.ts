// 화면 흐름. 지금 어느 화면인지는 이 상태 하나가 정한다. 저장은 App이 Store로 하고 결과만 이벤트로 넣는다.
import type { FirstScreen, Phrase, Profile, Stamp } from '../core/types.ts'
import { firstScreen } from '../core/session.ts'
import { bookProgress } from '../core/stamps.ts'

export type Screen =
  | { kind: 'setup' }
  | { kind: 'board' }
  | { kind: 'opening'; phrase: Phrase }
  | { kind: 'card'; phrase: Phrase }
  | { kind: 'partner'; phrase: Phrase }
  | { kind: 'stamped'; phrase: Phrase }
  | { kind: 'book'; closed: boolean }

/**
 * phrases는 로그인 직후 받아 둔 한마디. 카드는 여기서만 읽으므로 네트워크를 기다리지 않는다.
 * stamps는 아직 서버에 못 보낸 도장도 포함한다. stampNotice는 서버가 받지 않은 도장의 안내 (서버 문구).
 * opened는 이번에 한 번 열어 본 한마디 id. 다시 열 때는 흔들림 없이 바로 카드 (새로고침하면 비지만 도장 받은 것은 계속 바로)
 */
export type Session = {
  accountId: string
  profile: Profile
  stamps: Stamp[]
  phrases: Phrase[]
  screen: Screen
  stampNotice: string | null
  opened: string[]
}

/** null이면 로그인 화면 */
export type State = Session | null

export type Event =
  | { type: 'signedIn'; accountId: string; profile: Profile; stamps: Stamp[]; phrases: Phrase[]; first: FirstScreen }
  | { type: 'profileSaved'; profile: Profile }
  | { type: 'openPouch'; phrase: Phrase; instant: boolean }
  | { type: 'pouchOpened' }
  | { type: 'said' }
  | { type: 'again' }
  /** 「알아들었어요」: 서버를 기다리지 않고 기기 시각으로 바로 찍는다 */
  | { type: 'stamped'; at: string }
  /** 서버가 준 도장 목록으로 바꾼다. 어느 화면에서든 (지금 계정 것만) */
  | { type: 'stampsSynced'; accountId: string; stamps: Stamp[] }
  /** 서버가 없는 한마디라고 해서 버린 도장 */
  | { type: 'stampDropped'; accountId: string; phraseId: string; message: string }
  | { type: 'toBoard' }
  | { type: 'toBook' }
  | { type: 'closeBook' }
  | { type: 'openBook' }
  | { type: 'signOut' }
  /** 브라우저 뒤로 가기 (안드로이드 뒤로 버튼, iOS 스와이프) */
  | { type: 'back' }

/** 한마디판보다 깊은 화면. 들어갈 때 브라우저 기록을 하나 쌓아 뒤로 가기가 앱 밖으로 나가지 않게 한다 */
export const isDeep = (screen: Screen) => screen.kind !== 'setup' && screen.kind !== 'board'

/** 뒤로 가기로 한 단계 돌아갈 화면. 카드→판, 상대방→카드, 도장·도장첩→판 */
function backFrom(s: Screen): Screen {
  switch (s.kind) {
    case 'partner':
      return { kind: 'card', phrase: s.phrase }
    case 'opening':
    case 'card':
    case 'stamped':
    case 'book':
      return { kind: 'board' }
    default:
      return s
  }
}

/** 지금 화면에서 받을 수 없는 이벤트는 무시하고 같은 상태를 돌려준다. */
export function reduce(state: State, e: Event): State {
  if (e.type === 'signedIn') {
    return { accountId: e.accountId, profile: e.profile, stamps: e.stamps, phrases: e.phrases, screen: { kind: e.first }, stampNotice: null, opened: [] }
  }
  if (!state) return state
  if (e.type === 'signOut') return null
  if (e.type === 'stampsSynced') return e.accountId === state.accountId ? { ...state, stamps: e.stamps } : state
  if (e.type === 'stampDropped') {
    if (e.accountId !== state.accountId) return state
    return { ...state, stamps: state.stamps.filter((st) => st.phraseId !== e.phraseId), stampNotice: e.message }
  }
  const s = state.screen
  const go = (screen: Screen): State => ({ ...state, screen })

  switch (e.type) {
    case 'profileSaved':
      return s.kind === 'setup' ? { ...state, profile: e.profile, screen: { kind: firstScreen(e.profile) } } : state
    case 'openPouch': {
      if (s.kind !== 'board') return state
      const id = e.phrase.id
      const seen = state.opened.includes(id) || state.stamps.some((st) => st.phraseId === id)
      return {
        ...state,
        opened: state.opened.includes(id) ? state.opened : [...state.opened, id],
        screen: e.instant || seen ? { kind: 'card', phrase: e.phrase } : { kind: 'opening', phrase: e.phrase },
      }
    }
    case 'pouchOpened':
      return s.kind === 'opening' ? go({ kind: 'card', phrase: s.phrase }) : state
    case 'said':
      return s.kind === 'card' ? go({ kind: 'partner', phrase: s.phrase }) : state
    case 'again':
      return s.kind === 'partner' ? go({ kind: 'card', phrase: s.phrase }) : state
    case 'stamped': {
      if (s.kind !== 'partner') return state
      const has = state.stamps.some((st) => st.phraseId === s.phrase.id)
      const stamps = has ? state.stamps : [...state.stamps, { phraseId: s.phrase.id, at: e.at }]
      return { ...state, stamps, stampNotice: null, screen: { kind: 'stamped', phrase: s.phrase } }
    }
    case 'toBoard':
      return s.kind === 'card' || s.kind === 'stamped' || s.kind === 'book' ? go({ kind: 'board' }) : state
    case 'toBook':
      return s.kind === 'board' || s.kind === 'stamped' ? go({ kind: 'book', closed: false }) : state
    case 'closeBook':
      return s.kind === 'book' && bookProgress(state.stamps, state.phrases).complete ? go({ kind: 'book', closed: true }) : state
    case 'openBook':
      return s.kind === 'book' ? go({ kind: 'book', closed: false }) : state
    case 'back':
      return isDeep(s) ? go(backFrom(s)) : state
  }
}
