// 이치마디 FE의 데이터 모양. 화면, 로직, 저장이 모두 이 모양으로 주고받는다.

export type Animal = 'tiger' | 'rabbit' | 'magpie' | 'bear'

/** 행사장 한마디 하나. 문장이 확정되면 data/phrases.ts만 바꾼다. */
export type Phrase = {
  id: string
  ko: string
  kana: string
  ja: string
  /** 쓰는 때 (일본어) */
  when: string
  /** 상대가 할 법한 대답 */
  reply: string
  replyKana: string
  replyJa: string
}

/** 처음 로그인할 때 정하는 것. 둘 다 정해야 한마디판으로 간다. */
export type Profile = {
  animal: Animal | null
  koreanName: string | null
}

export type Stamp = {
  phraseId: string
  /** 받은 시각, ISO 문자열 */
  at: string
}

export type TrialAccount = { id: string; password: string }

/**
 * 저장 연결. 지금은 기기 저장(createLocalStore), 서버가 정해지면 같은 모양의 서버 연결로 바꾼다.
 * 화면은 이것으로만 저장에 닿는다 (P-05).
 */
export interface Store {
  login(id: string, password: string): Promise<{ accountId: string } | null>
  getProfile(accountId: string): Promise<Profile>
  saveProfile(accountId: string, profile: Profile): Promise<void>
  getStamps(accountId: string): Promise<Stamp[]>
  /** 같은 한마디는 한 번만 저장한다 (P-01). 저장 뒤 전체 도장 목록을 돌려준다. */
  addStamp(accountId: string, phraseId: string, at?: Date): Promise<Stamp[]>
}

/** 로그인 직후 갈 화면 */
export type FirstScreen = 'animal' | 'name' | 'board'
