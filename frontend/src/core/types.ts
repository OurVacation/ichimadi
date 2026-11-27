// 이치마디 FE의 데이터 모양. 화면, 로직, 저장이 모두 이 모양으로 주고받는다.

export type Animal = 'tiger' | 'rabbit' | 'magpie' | 'bear'

/** 행사장 한마디 하나. 서버(GET /api/phrases)에서 받는다. 원본은 content/phrases.json (DB 시드) */
export type Phrase = {
  id: string
  /** 지도 핀에 붙는 짧은 이름표 (일본어) */
  label: string
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

/** 처음 로그인할 때 설정 화면 하나에서 같이 정한다. 둘 다 정해야 한마디판으로 간다. */
export type Profile = {
  animal: Animal | null
  /** null은 아직 안 정함, ''는 이름을 패스함 (동물만 있는 도장) */
  koreanName: string | null
}

export type Stamp = {
  phraseId: string
  /** 받은 시각, ISO 문자열 */
  at: string
}

export type TrialAccount = { id: string; password: string }

/**
 * 저장 연결. 기본은 서버(api/store.ts), 오프라인 시연은 기기 저장(createLocalStore). main.tsx가 고른다.
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

/** 한국식 이름 후보 하나. note는 왜 이 이름인지 (일본어, 없어도 된다) */
export type NameCandidate = { name: string; note?: string }

/**
 * 이름 짓기를 끼우는 자리. 일본 이름 전체(성+이름)를 받아 후보를 돌려준다.
 * 기본은 서버(api/names.ts, 안 되면 임시 규칙), 오프라인 시연은 임시 규칙(core/nameGenerator.ts). main.tsx가 고른다.
 */
export type NameGenerator = (fullName: string) => Promise<NameCandidate[]>

/** 한마디 목록을 받는 자리. 로그인 직후 한 번 부른다. 못 받으면 던진다 (화면이 다시 시도하게 한다) */
export type PhraseSource = () => Promise<Phrase[]>

/** 로그인 직후 갈 화면 */
export type FirstScreen = 'setup' | 'board'
