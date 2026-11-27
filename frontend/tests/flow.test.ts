// 화면 흐름과 한마디판: 한마디는 로그인 때 받은 목록(phrases)만 쓴다. 지도에 자리가 없는 id도 깨지지 않는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Phrase, Stamp } from '../src/core/types.ts'
import { placePins } from '../src/data/boardMap.ts'
import { reduce, type State } from '../src/ui/flow.ts'

const phrase = (id: string): Phrase => ({
  id,
  label: id,
  ko: '안녕하세요',
  kana: 'アンニョンハセヨ',
  ja: 'こんにちは',
  when: 'あいさつ',
  reply: '네',
  replyKana: 'ネ',
  replyJa: 'はい',
})
const stamp = (phraseId: string): Stamp => ({ phraseId, at: '2026-11-29T05:00:00Z' })

function signedIn(phrases: Phrase[], stamps: Stamp[] = []): State {
  return reduce(null, {
    type: 'signedIn',
    accountId: 'j01',
    profile: { animal: 'tiger', koreanName: '양자' },
    stamps,
    phrases,
    first: 'board',
  })
}

test('로그인 때 받은 한마디로 카드를 열고 도장을 받는다', () => {
  const phrases = [phrase('q1'), phrase('q2')]
  let s = signedIn(phrases)
  assert.deepEqual(s?.phrases, phrases)
  s = reduce(s, { type: 'openPouch', phrase: phrases[1], instant: true })
  assert.deepEqual(s?.screen, { kind: 'card', phrase: phrases[1] })
  s = reduce(s, { type: 'said' })
  s = reduce(s, { type: 'stamped', stamps: [stamp('q2')] })
  assert.deepEqual(s?.screen, { kind: 'stamped', phrase: phrases[1] })
  assert.deepEqual(s?.phrases, phrases)
})

test('도장첩 닫기는 받은 한마디를 다 모았을 때만 된다 (받은 목록 기준)', () => {
  const phrases = [phrase('q1'), phrase('q7')]
  const half = reduce(reduce(signedIn(phrases, [stamp('q1')]), { type: 'toBook' }), { type: 'closeBook' })
  assert.deepEqual(half?.screen, { kind: 'book', closed: false })
  const full = reduce(reduce(signedIn(phrases, [stamp('q1'), stamp('q7')]), { type: 'toBook' }), { type: 'closeBook' })
  assert.deepEqual(full?.screen, { kind: 'book', closed: true })
})

test('지도: 한마디 순서대로 자리와 번호를 붙인다', () => {
  const pins = placePins([phrase('q2'), phrase('q1')])
  assert.deepEqual(
    pins.map((p) => [p.phrase.id, p.n, p.spot]),
    [
      ['q2', 1, { x: 73, y: 24 }],
      ['q1', 2, { x: 25, y: 14 }],
    ],
  )
})

test('지도: 자리가 없는 한마디 id는 지도에서 빼고 나머지는 그대로 이어 번호를 붙인다', () => {
  const pins = placePins([phrase('q1'), phrase('zz-new'), phrase('q3')])
  assert.deepEqual(
    pins.map((p) => [p.phrase.id, p.n]),
    [
      ['q1', 1],
      ['q3', 2],
    ],
  )
  assert.deepEqual(placePins([phrase('zz-new')]), [])
})
