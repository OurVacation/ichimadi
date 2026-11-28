// 한마디판 지도: 모든 복주머니가 지도 안에 자리가 있다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { POUCH_SPOTS, stampOffset } from '../src/data/boardMap.ts'
import { PHRASES } from '../src/data/phrases.ts'

test('한마디마다 지도 위 자리가 하나씩 있고 모두 지도 안쪽이다', () => {
  assert.deepEqual(Object.keys(POUCH_SPOTS).sort(), PHRASES.map((p) => p.id).sort())
  for (const [id, { x, y }] of Object.entries(POUCH_SPOTS)) {
    assert.ok(x >= 15 && x <= 85 && y >= 10 && y <= 90, id)
  }
})
test('자리끼리 겹치지 않는다 (가로나 세로로 충분히 떨어짐)', () => {
  const spots = Object.entries(POUCH_SPOTS)
  for (const [a, p] of spots)
    for (const [b, q] of spots) {
      if (a >= b) continue
      assert.ok(Math.abs(p.x - q.x) >= 30 || Math.abs(p.y - q.y) >= 18, `${a}-${b}`)
    }
})

test('지도 도장 자리: 한마디 id로 정해져 늘 같고, 가로·세로 ±6px, 기울기 -14°~+10° 안이다', () => {
  const ids = [...Object.keys(POUCH_SPOTS), 'zz-new', '', 'こんにちは', 'q'.repeat(50)]
  for (const id of ids) {
    const o = stampOffset(id)
    assert.deepEqual(stampOffset(id), o, id)
    assert.ok(Math.abs(o.dx) <= 6 && Math.abs(o.dy) <= 6, `${id} ${JSON.stringify(o)}`)
    assert.ok(o.rotate >= -14 && o.rotate <= 10, `${id} ${JSON.stringify(o)}`)
  }
  // 복주머니마다 조금씩 다르게 찍힌다
  for (const k of ['dx', 'dy', 'rotate'] as const) {
    assert.ok(new Set(Object.keys(POUCH_SPOTS).map((id) => stampOffset(id)[k])).size > 2, k)
  }
})
