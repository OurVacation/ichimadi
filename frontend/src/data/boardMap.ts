// 한마디판 지도에서 복주머니가 놓이는 자리. 지도 그림(ui/map.tsx) 안의 퍼센트 (x: 왼쪽→오른쪽, y: 위→아래).
// 서울 지도로 바꿀 때는 그림과 이 표만 바꾼다. 한마디 순서대로 길(점선)이 이어진다.
export type Spot = { x: number; y: number }

export const POUCH_SPOTS: Record<string, Spot> = {
  q1: { x: 25, y: 14 },
  q2: { x: 73, y: 24 },
  q3: { x: 28, y: 42 },
  q4: { x: 74, y: 52 },
  q5: { x: 27, y: 77 },
  q6: { x: 72, y: 88 },
}

export type Pin<P> = { phrase: P; spot: Spot; n: number }

/** 한마디 순서대로 지도 자리를 붙인다. 자리가 없는 한마디(지도에 없는 새 id)는 지도에서 뺀다. n은 지도 위 번호(1부터) */
export function placePins<P extends { id: string }>(phrases: P[]): Pin<P>[] {
  return phrases
    .filter((phrase) => phrase.id in POUCH_SPOTS)
    .map((phrase, i) => ({ phrase, spot: POUCH_SPOTS[phrase.id], n: i + 1 }))
}

/** 지도 핀의 도장이 찍힌 자리: 복주머니 오른쪽 위에서 가로·세로 px, 기울기 deg */
export type StampOffset = { dx: number; dy: number; rotate: number }

/** 한마디 id로 정한다 (FNV-1a + 섞기). 새로고침해도 같은 자리. 가로·세로 ±6px, 기울기 -14°~+10° */
export function stampOffset(phraseId: string): StampOffset {
  let h = 0x811c9dc5
  for (const ch of phraseId) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0
  // 끝 글자만 다른 id(q1, q2…)도 세 값이 모두 갈리게 섞는다 (murmur3 fmix32)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h = (h ^ (h >>> 16)) >>> 0
  const unit = (shift: number) => ((h >>> shift) & 0xff) / 255
  return { dx: Math.round(unit(0) * 12 - 6), dy: Math.round(unit(8) * 12 - 6), rotate: Math.round(unit(16) * 24 - 14) }
}
