// W-03 (H-01), W-12 (H-02): 로그인 뒤 어디로 가는가
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstScreen } from '../src/core/session.ts'
import { createLocalStore } from '../src/core/store.ts'
import { parseTrialAccounts } from '../src/data/accounts.ts'
import type { Store } from '../src/core/types.ts'
import { memoryStorage } from './helpers.ts'

// App이 로그인 직후 하는 일: 로그인 → 내 정보 → 처음 화면
async function signIn(store: Store, id: string, password: string) {
  const r = await store.login(id, password)
  return r && { accountId: r.accountId, screen: firstScreen(await store.getProfile(r.accountId)) }
}

test('체험 계정 설정 문자열을 읽는다: 형식이 틀린 것과 겹치는 아이디는 버린다', () => {
  assert.deepEqual(parseTrialAccounts('judge01:1111, judge02:2222,bad,:3333,judge01:9999,judge03:'), [
    { id: 'judge01', password: '1111' },
    { id: 'judge02', password: '2222' },
  ])
  assert.deepEqual(parseTrialAccounts(undefined), [])
})

test('동물이나 이름 중 하나라도 없으면 설정 화면 (이름과 동물을 한 화면에서)', () => {
  assert.equal(firstScreen({ animal: null, koreanName: null }), 'setup')
  assert.equal(firstScreen({ animal: 'bear', koreanName: null }), 'setup')
  assert.equal(firstScreen({ animal: null, koreanName: '양자' }), 'setup')
})
test('둘 다 있으면 바로 한마디판', () => {
  assert.equal(firstScreen({ animal: 'bear', koreanName: '양자' }), 'board')
})
test('이름을 패스하면(빈 이름) 동물만으로 한마디판', () => {
  assert.equal(firstScreen({ animal: 'bear', koreanName: '' }), 'board')
  assert.equal(firstScreen({ animal: null, koreanName: '' }), 'setup')
})

test('로그인: 틀리면 거절, 맞으면 처음 화면, 설정 뒤 다시 로그인하면 바로 한마디판', async () => {
  const store = createLocalStore(memoryStorage(), [{ id: 'judge01', password: '1111' }])
  assert.equal(await signIn(store, 'judge01', '0000'), null)
  assert.deepEqual(await signIn(store, 'judge01', '1111'), { accountId: 'judge01', screen: 'setup' })
  await store.saveProfile('judge01', { animal: 'tiger', koreanName: '양자' })
  assert.deepEqual(await signIn(store, 'judge01', '1111'), { accountId: 'judge01', screen: 'board' })
})

test('이름을 패스한 설정도 저장되고, 다시 로그인하면 바로 한마디판', async () => {
  const store = createLocalStore(memoryStorage(), [{ id: 'judge01', password: '1111' }])
  await store.saveProfile('judge01', { animal: 'rabbit', koreanName: '' })
  assert.deepEqual(await store.getProfile('judge01'), { animal: 'rabbit', koreanName: '' })
  assert.deepEqual(await signIn(store, 'judge01', '1111'), { accountId: 'judge01', screen: 'board' })
})
