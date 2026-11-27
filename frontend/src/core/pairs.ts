export type WordPair = { ko: string; kana: string }

/**
 * 한국어 어절과 가타카나 덩어리를 짝짓는다. 한국어는 띄어쓰기로, 가타카나는 띄어쓰기와 「、」 뒤에서 나눈다.
 * 수가 맞지 않으면 null (화면은 가타카나 한 줄로 보여 준다).
 */
export function pairWords(ko: string, kana: string): WordPair[] | null {
  const words = ko.trim().split(/\s+/)
  const chunks = kana
    .trim()
    .split(/[\s　]+|(?<=、)/)
    .filter(Boolean)
  return words.length === chunks.length ? words.map((w, i) => ({ ko: w, kana: chunks[i] })) : null
}
