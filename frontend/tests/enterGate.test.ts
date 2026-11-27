// 폰 하나를 둘이 쓸 때: 늦게 끝난 지난 들어가기는 화면에 넣지 않는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEnterGate } from '../src/ui/enterGate.ts'

test('가장 최근 들어가기만 화면에 넣는다', () => {
  let current: string | null = 'a01'
  const gate = createEnterGate(() => current)
  const a = gate.begin('a01')
  current = 'b01'
  const b = gate.begin('b01')
  assert.equal(a(), false)
  assert.equal(b(), true)
})

test('지금 로그인한 계정이 아니면 최근 것이라도 넣지 않는다', () => {
  let current: string | null = 'a01'
  const gate = createEnterGate(() => current)
  const a = gate.begin('a01')
  current = 'b01'
  assert.equal(a(), false)
  current = null
  assert.equal(gate.begin('a01')(), false)
})

test('취소하면 진행 중인 들어가기는 모두 버린다', () => {
  const gate = createEnterGate(() => 'a01')
  const a = gate.begin('a01')
  gate.cancel()
  assert.equal(a(), false)
  assert.equal(gate.begin('a01')(), true)
})
