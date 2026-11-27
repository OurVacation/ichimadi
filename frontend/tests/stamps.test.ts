// W-06 (H-09): 도장첩 계산. P-04 N은 받은 도장 수와 같고 0~전체
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookProgress, formatStampTime } from '../src/core/stamps.ts'

const phrases = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map((id) => ({ id }))
const at = '2026-11-29T05:00:00.000Z'

test('도장이 없으면 0/6', () => {
  assert.deepEqual(bookProgress([], phrases), { count: 0, total: 6, complete: false })
})
test('6개 모두면 6/6과 완성', () => {
  const stamps = phrases.map((p) => ({ phraseId: p.id, at }))
  assert.deepEqual(bookProgress(stamps, phrases), { count: 6, total: 6, complete: true })
})
test('없는 한마디의 도장이나 겹친 도장은 세지 않는다', () => {
  const stamps = [
    { phraseId: 'q1', at },
    { phraseId: 'q1', at },
    { phraseId: 'old', at },
  ]
  assert.deepEqual(bookProgress(stamps, phrases), { count: 1, total: 6, complete: false })
})
test('받은 시각은 「11/29 14:05」 꼴 (기기 시간)', () => {
  const local = new Date(2026, 10, 29, 14, 5)
  assert.equal(formatStampTime(local.toISOString()), '11/29 14:05')
  assert.equal(formatStampTime(new Date(2026, 0, 3, 9, 7).toISOString()), '1/3 09:07')
})
