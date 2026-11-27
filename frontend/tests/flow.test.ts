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
  s = reduce(s, { type: 'stamped', at: '2026-11-29T05:00:00Z' })
  assert.deepEqual(s?.screen, { kind: 'stamped', phrase: phrases[1] })
  assert.deepEqual(s?.stamps, [stamp('q2')])
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

test('「알아들었어요」는 서버를 기다리지 않고 바로 찍는다. 이미 받은 한마디는 첫 시각 그대로', () => {
  const phrases = [phrase('q1')]
  const toPartner = (st: State) => reduce(reduce(reduce(st, { type: 'openPouch', phrase: phrases[0], instant: true }), { type: 'said' }), { type: 'stamped', at: '2026-11-29T09:00:00Z' })
  assert.deepEqual(toPartner(signedIn(phrases))?.stamps, [{ phraseId: 'q1', at: '2026-11-29T09:00:00Z' }])
  assert.deepEqual(toPartner(signedIn(phrases, [stamp('q1')]))?.stamps, [stamp('q1')])
})

test('서버 도장 목록은 어느 화면에서든 바꾼다. 다른 계정의 목록은 무시한다', () => {
  const phrases = [phrase('q1'), phrase('q2')]
  const onCard = reduce(signedIn(phrases), { type: 'openPouch', phrase: phrases[0], instant: true })
  const synced = reduce(onCard, { type: 'stampsSynced', accountId: 'j01', stamps: [stamp('q2')] })
  assert.deepEqual(synced?.stamps, [stamp('q2')])
  assert.deepEqual(synced?.screen, onCard?.screen)
  assert.equal(reduce(onCard, { type: 'stampsSynced', accountId: 'other', stamps: [stamp('q2')] }), onCard)
})

test('서버가 받지 않은 도장(404)은 지우고 서버 문구를 남긴다. 다음 도장을 찍으면 문구는 사라진다', () => {
  const phrases = [phrase('q1'), phrase('q2')]
  const s = reduce(signedIn(phrases, [stamp('q1'), stamp('q2')]), { type: 'stampDropped', accountId: 'j01', phraseId: 'q1', message: 'この一言は見つかりませんでした' })
  assert.deepEqual(s?.stamps, [stamp('q2')])
  assert.equal(s?.stampNotice, 'この一言は見つかりませんでした')
  const next = reduce(reduce(reduce(s, { type: 'openPouch', phrase: phrases[0], instant: true }), { type: 'said' }), { type: 'stamped', at: '2026-11-29T09:00:00Z' })
  assert.equal(next?.stampNotice, null)
  const other = signedIn(phrases, [stamp('q1')])
  assert.equal(reduce(other, { type: 'stampDropped', accountId: 'other', phraseId: 'q1', message: 'x' }), other)
})

test('한 번 열어 본 복주머니와 도장 받은 복주머니는 흔들림 없이 바로 카드', () => {
  const phrases = [phrase('q1'), phrase('q2'), phrase('q3')]
  let s = signedIn(phrases, [stamp('q3')])
  s = reduce(s, { type: 'openPouch', phrase: phrases[0], instant: false })
  assert.deepEqual(s?.screen, { kind: 'opening', phrase: phrases[0] })
  s = reduce(reduce(s, { type: 'pouchOpened' }), { type: 'toBoard' })
  assert.deepEqual(reduce(s, { type: 'openPouch', phrase: phrases[0], instant: false })?.screen, { kind: 'card', phrase: phrases[0] })
  assert.deepEqual(reduce(s, { type: 'openPouch', phrase: phrases[1], instant: false })?.screen, { kind: 'opening', phrase: phrases[1] })
  assert.deepEqual(reduce(s, { type: 'openPouch', phrase: phrases[2], instant: false })?.screen, { kind: 'card', phrase: phrases[2] })
  // 다시 로그인(새로고침)하면 열어 본 기록은 없다
  assert.deepEqual(signedIn(phrases)?.opened, [])
})
