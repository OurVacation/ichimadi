// W-08 (H-12): 화면 글자. 일본어 화면에는 한글이 없고, 상대방 화면은 한국어
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JA, PARTNER } from '../src/i18n.ts'

const hangul = /[가-힣]/
function values(o: Record<string, unknown>): string[] {
  return Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'function' ? [String((v as (n: number) => string)(3))] : values(v as Record<string, unknown>)))
}

test('일본어 글자는 비어 있지 않고 한글이 없다', () => {
  const v = values(JA)
  assert.ok(v.length >= 20)
  for (const s of v) {
    assert.ok(s.trim().length > 0)
    assert.doesNotMatch(s, hangul, s)
  }
})
test('상대방 화면 글자는 한국어다', () => {
  for (const s of values(PARTNER)) assert.match(s, hangul, s)
})
