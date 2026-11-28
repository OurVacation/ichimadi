// 한글 이름을 가타카나 읽기로 (설정 화면의 이름 후보 아래에 보인다). 이름 정도의 짧은 말을 위한 간단한 규칙이다.
// 첫 글자의 ㄱㄷㅂㅈ은 맑게(カ タ パ チャ), 모음이나 ㄴㄹㅁㅇ 받침 뒤에서는 흐리게(ガ ダ バ ジャ) 읽는다.

/** 자음 줄: [a, i, u, e, o, ya, yu, yo] */
const ROWS: Record<string, string[]> = {
  k: ['カ', 'キ', 'ク', 'ケ', 'コ', 'キャ', 'キュ', 'キョ'],
  g: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ギャ', 'ギュ', 'ギョ'],
  n: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ニャ', 'ニュ', 'ニョ'],
  t: ['タ', 'ティ', 'トゥ', 'テ', 'ト', 'テャ', 'テュ', 'テョ'],
  d: ['ダ', 'ディ', 'ドゥ', 'デ', 'ド', 'デャ', 'デュ', 'デョ'],
  r: ['ラ', 'リ', 'ル', 'レ', 'ロ', 'リャ', 'リュ', 'リョ'],
  m: ['マ', 'ミ', 'ム', 'メ', 'モ', 'ミャ', 'ミュ', 'ミョ'],
  p: ['パ', 'ピ', 'プ', 'ペ', 'ポ', 'ピャ', 'ピュ', 'ピョ'],
  b: ['バ', 'ビ', 'ブ', 'ベ', 'ボ', 'ビャ', 'ビュ', 'ビョ'],
  s: ['サ', 'シ', 'ス', 'セ', 'ソ', 'シャ', 'シュ', 'ショ'],
  '': ['ア', 'イ', 'ウ', 'エ', 'オ', 'ヤ', 'ユ', 'ヨ'],
  ch: ['チャ', 'チ', 'チュ', 'チェ', 'チョ', 'チャ', 'チュ', 'チョ'],
  j: ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ', 'ジャ', 'ジュ', 'ジョ'],
  h: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'ヒャ', 'ヒュ', 'ヒョ'],
}

/** 초성 19개 → 자음 줄 (맑은 소리) */
const INITIAL = ['k', 'k', 'n', 't', 't', 'r', 'm', 'p', 'p', 's', 's', '', 'ch', 'ch', 'ch', 'k', 't', 'p', 'h']
/** 모음 앞에서 흐리게 읽는 자음 */
const VOICED: Record<string, string> = { k: 'g', t: 'd', p: 'b', ch: 'j' }
/** 중성 21개 → [모음 칸, 앞에 붙는 w 소리] (칸: 0 a 1 i 2 u 3 e 4 o 5 ya 6 yu 7 yo, 8 = ye) */
const MEDIAL: [number, string][] = [
  [0, ''], [3, ''], [5, ''], [8, ''], [4, ''], [3, ''], [7, ''], [8, ''], [4, ''], [0, 'w'], [3, 'w'],
  [3, 'w'], [7, ''], [2, ''], [4, 'w'], [3, 'w'], [1, 'w'], [6, ''], [2, ''], [1, ''], [1, ''],
]
/** 종성 28개 → 가타카나 (0 = 받침 없음) */
const FINAL = ['', 'ク', 'ク', 'ク', 'ン', 'ン', 'ン', 'ッ', 'ル', 'ク', 'ム', 'ル', 'ル', 'ル', 'プ', 'ル', 'ム', 'プ', 'プ', 'ッ', 'ッ', 'ン', 'ッ', 'ッ', 'ク', 'ッ', 'プ', 'ッ']
/** 뒤 글자를 흐리게 만드는 받침: 없음, ㄴ ㄹ ㅁ ㅇ */
const SOFT_FINAL = new Set([0, 4, 8, 16, 21])
const SMALL: Record<number, string> = { 0: 'ァ', 1: 'ィ', 3: 'ェ', 4: 'ォ' }

function syllable(row: string, col: number, w: string): string {
  const r = ROWS[row]
  if (w) {
    if (row === '') return col === 0 ? 'ワ' : col === 4 ? 'ウォ' : `ウ${SMALL[col] ?? ''}`
    return r[2].slice(0, 1) + (SMALL[col] ?? '')
  }
  if (col === 8) return row === '' ? 'イェ' : r[3]
  return r[col]
}

export function hangulToKatakana(name: string): string {
  let out = ''
  let softBefore = false
  let first = true
  for (const ch of name) {
    const code = ch.codePointAt(0)! - 0xac00
    if (code < 0 || code > 11171) {
      out += ch
      first = true
      continue
    }
    const ini = Math.floor(code / 588)
    const med = Math.floor((code % 588) / 28)
    const fin = code % 28
    let row = INITIAL[ini]
    // 된소리(ㄲ ㄸ ㅃ ㅆ ㅉ)와 거센소리(ㅊ ㅋ ㅌ ㅍ)는 흐리지 않는다
    const tense = [1, 4, 8, 10, 13, 14, 15, 16, 17].includes(ini)
    if (!first && softBefore && !tense && VOICED[row]) row = VOICED[row]
    const [col, w] = MEDIAL[med]
    out += syllable(row, col, w) + FINAL[fin]
    softBefore = SOFT_FINAL.has(fin)
    first = false
  }
  return out
}
