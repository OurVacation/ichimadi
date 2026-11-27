// QR 자동 로그인: 주소 끝 #login=<id>.<password>를 읽는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLoginHash } from '../src/core/loginHash.ts'

const qrHash = (id: string, password: string) => `#login=${encodeURIComponent(id)}.${encodeURIComponent(password)}`

test('QR 카드의 해시에서 아이디와 비밀번호를 읽는다', () => {
  assert.deepEqual(parseLoginHash('#login=judge01.4821'), { kind: 'login', id: 'judge01', password: '4821' })
})
test('인코딩된 글자도 되돌린다. 점은 첫 번째에서만 자른다', () => {
  assert.deepEqual(parseLoginHash(qrHash('judge 01', 'a.b#c%')), { kind: 'login', id: 'judge 01', password: 'a.b#c%' })
  assert.deepEqual(parseLoginHash('#login=judge01.a.b'), { kind: 'login', id: 'judge01', password: 'a.b' })
})
test('점이 없거나 한쪽이 비었거나 인코딩이 깨지면 형식 오류', () => {
  for (const hash of ['#login=judge01', '#login=', '#login=.4821', '#login=judge01.', '#login=judge01.%E0%A4%A']) {
    assert.deepEqual(parseLoginHash(hash), { kind: 'malformed' }, hash)
  }
})
test('로그인 해시가 아니면 없음', () => {
  for (const hash of ['', '#', '#board', '#Login=judge01.1', 'login=judge01.1']) {
    assert.deepEqual(parseLoginHash(hash), { kind: 'none' }, hash)
  }
})
