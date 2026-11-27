// W-05 (H-04), W-11 (H-06): 한마디 데이터. 화면은 이 파일만 읽는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PHRASES } from '../src/data/phrases.ts'

test('한마디는 6개이고 id가 겹치지 않는다', () => {
  assert.equal(PHRASES.length, 6)
  assert.equal(new Set(PHRASES.map((p) => p.id)).size, 6)
})
test('모든 칸이 비어 있지 않다 (한국어, 가타카나, 일본어 뜻, 쓰는 때, 대답 예시)', () => {
  for (const p of PHRASES) {
    for (const k of ['ko', 'kana', 'ja', 'when', 'reply', 'replyKana', 'replyJa'] as const) {
      assert.ok(p[k].trim().length > 0, `${p.id}.${k}`)
    }
  }
})
test('한국어 칸은 한글, 가타카나 칸은 가타카나다', () => {
  for (const p of PHRASES) {
    assert.match(p.ko, /[가-힣]/, p.id)
    assert.match(p.kana, /^[゠-ヿ\s、。？！?!・ー]+$/, p.id)
    assert.doesNotMatch(p.ja, /[가-힣]/, p.id)
  }
})
