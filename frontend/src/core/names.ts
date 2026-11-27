// 임시 규칙 (A-03). 팀이 이름 짓기 규칙을 정하면 이 파일만 바꾼다.
// 한자는 한국 한자음으로, 가나는 소리대로 한글로 옮기고, 인기 한국 이름으로 3개를 채운다.
import hanjaKorean from '../data/hanjaKorean.json' with { type: 'json' }

const HANJA: Record<string, string> = hanjaKorean
const CANDIDATE_COUNT = 3

const POPULAR_NAMES = [
  '서연', '민준', '지우', '하윤', '도윤', '서준', '수아', '예준', '유나', '지호', '하은', '시우',
  '채원', '건우', '다은', '태윤', '나연', '보라', '민서', '현우', '소윤', '준서', '윤아', '가은',
]

const KANA: Record<string, string> = {
  ア: '아', イ: '이', ウ: '우', エ: '에', オ: '오',
  カ: '카', キ: '키', ク: '쿠', ケ: '케', コ: '코',
  ガ: '가', ギ: '기', グ: '구', ゲ: '게', ゴ: '고',
  サ: '사', シ: '시', ス: '스', セ: '세', ソ: '소',
  ザ: '자', ジ: '지', ズ: '즈', ゼ: '제', ゾ: '조',
  タ: '타', チ: '치', ツ: '츠', テ: '테', ト: '토',
  ダ: '다', ヂ: '지', ヅ: '즈', デ: '데', ド: '도',
  ナ: '나', ニ: '니', ヌ: '누', ネ: '네', ノ: '노',
  ハ: '하', ヒ: '히', フ: '후', ヘ: '헤', ホ: '호',
  バ: '바', ビ: '비', ブ: '부', ベ: '베', ボ: '보',
  パ: '파', ピ: '피', プ: '푸', ペ: '페', ポ: '포',
  マ: '마', ミ: '미', ム: '무', メ: '메', モ: '모',
  ヤ: '야', ユ: '유', ヨ: '요',
  ラ: '라', リ: '리', ル: '루', レ: '레', ロ: '로',
  ワ: '와', ヲ: '오', ヴ: '부',
  キャ: '캬', キュ: '큐', キョ: '쿄', ギャ: '갸', ギュ: '규', ギョ: '교',
  シャ: '샤', シュ: '슈', ショ: '쇼', ジャ: '자', ジュ: '주', ジョ: '조',
  チャ: '차', チュ: '추', チョ: '초', ヂャ: '자', ヂュ: '주', ヂョ: '조',
  ニャ: '냐', ニュ: '뉴', ニョ: '뇨', ヒャ: '햐', ヒュ: '휴', ヒョ: '효',
  ビャ: '뱌', ビュ: '뷰', ビョ: '뵤', ピャ: '퍄', ピュ: '퓨', ピョ: '표',
  ミャ: '먀', ミュ: '뮤', ミョ: '묘', リャ: '랴', リュ: '류', リョ: '료',
  ファ: '파', フィ: '피', フェ: '페', フォ: '포', ティ: '티', ディ: '디',
  トゥ: '투', ドゥ: '두', ウィ: '위', ウェ: '웨', ウォ: '워',
  シェ: '셰', ジェ: '제', チェ: '체', ヴァ: '바', ヴィ: '비', ヴェ: '베', ヴォ: '보',
}

const HANGUL_BASE = 0xac00
const JONG_N = 4
const JONG_S = 19
const MEDIAL_U = [13, 17, 18]
const MEDIAL_O = [8, 12]

const parts = (syllable: string) => {
  const code = syllable.charCodeAt(0) - HANGUL_BASE
  return { initial: Math.floor(code / 588), medial: Math.floor((code % 588) / 28), final: code % 28 }
}
const compose = (initial: number, medial: number, final: number) =>
  String.fromCharCode(HANGUL_BASE + initial * 588 + medial * 28 + final)

/** 한글로 넣은 이름(1~10음절, 띄어쓰기는 뺌)은 그대로 쓴다. 한국인 팀원이 시험할 때 막히지 않게 */
export function hangulName(input: string): string | null {
  const name = input.normalize('NFKC').replace(/\s+/g, '')
  return /^[가-힣]{1,10}$/.test(name) ? name : null
}

export function koreanNameCandidates(input: string): string[] {
  const given = input.normalize('NFKC').trim().split(/\s+/).pop() ?? ''
  const syllables = readName(given)
  if (!syllables) return []
  const first = syllables.join('')
  const initial = parts(first).initial
  const fill = [
    ...POPULAR_NAMES.filter((n) => parts(n).initial === initial),
    ...POPULAR_NAMES.filter((n) => parts(n).initial !== initial),
  ]
  return [first, ...fill.filter((n) => n !== first)].slice(0, CANDIDATE_COUNT)
}

function readName(name: string): string[] | null {
  const out: string[] = []
  let kana = ''
  let prevHanja = ''
  const flushKana = () => {
    if (!kana) return true
    const ok = transliterate(kana, out)
    kana = ''
    return ok
  }
  for (const ch of name) {
    if (isKana(ch)) {
      kana += toKatakana(ch)
      continue
    }
    if (!flushKana()) return null
    const reading = ch === '々' ? prevHanja : HANJA[ch]
    if (!reading) return null
    out.push(out.length === 0 ? initialSoundRule(reading) : reading)
    prevHanja = reading
  }
  if (!flushKana()) return null
  return out.length > 0 ? out : null
}

function initialSoundRule(syllable: string): string {
  const { initial, medial, final } = parts(syllable)
  const yOrI = [2, 3, 6, 7, 12, 17, 20].includes(medial)
  if (initial === 5) return compose(yOrI ? 11 : 2, medial, final)
  if (initial === 2 && yOrI) return compose(11, medial, final)
  return syllable
}

const isKana = (ch: string) => /[ぁ-ゖァ-ヺー]/.test(ch)
const toKatakana = (ch: string) =>
  /[ぁ-ゖ]/.test(ch) ? String.fromCharCode(ch.charCodeAt(0) + 0x60) : ch

function transliterate(katakana: string, out: string[]): boolean {
  const addFinal = (final: number) => {
    const last = out[out.length - 1]
    if (!last || parts(last).final !== 0) return false
    const p = parts(last)
    out[out.length - 1] = compose(p.initial, p.medial, final)
    return true
  }
  const lastOpenVowel = () => {
    const last = out[out.length - 1]
    if (!last) return null
    const p = parts(last)
    return p.final === 0 ? p.medial : null
  }
  for (let i = 0; i < katakana.length; i++) {
    const ch = katakana[i]
    const pair = KANA[ch + katakana[i + 1]]
    if (pair) {
      out.push(pair)
      i++
      continue
    }
    const vowel = lastOpenVowel()
    if (ch === 'ー') continue
    if (ch === 'ウ' && vowel !== null && (MEDIAL_U.includes(vowel) || MEDIAL_O.includes(vowel))) continue
    if (ch === 'オ' && vowel !== null && MEDIAL_O.includes(vowel)) continue
    if (ch === 'ン') {
      if (!addFinal(JONG_N)) out.push('은')
      continue
    }
    if (ch === 'ッ') {
      addFinal(JONG_S)
      continue
    }
    const single = KANA[ch]
    if (!single) return false
    out.push(single)
  }
  return true
}
