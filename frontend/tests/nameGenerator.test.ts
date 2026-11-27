// 이름 짓기 자리(NameGenerator)의 기본 구현
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { temporaryNameGenerator } from '../src/core/nameGenerator.ts'

test('성명 전체를 받아 후보 3개를 돌려준다. 첫 후보는 이름의 한국어 읽기', async () => {
  const c = await temporaryNameGenerator('田中 陽子')
  assert.equal(c.length, 3)
  assert.equal(c[0].name, '양자')
  for (const n of c) assert.match(n.name, /^[가-힣]+$/)
})
test('읽을 수 없으면 후보 없음', async () => {
  assert.deepEqual(await temporaryNameGenerator('abc'), [])
})
