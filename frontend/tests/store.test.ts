// W-01 (H-10): 저장 연결. P-01 같은 도장 하나, P-02 다시 열어도 남음, P-03 계정끼리 섞이지 않음
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalStore, openStorage } from '../src/core/store.ts'
import { memoryStorage } from './helpers.ts'

const accounts = [
  { id: 'judge01', password: '1111' },
  { id: 'judge02', password: '2222' },
]

test('같은 한마디 도장을 두 번 받아도 하나만 남는다 (P-01)', async () => {
  const store = createLocalStore(memoryStorage(), accounts)
  await store.addStamp('judge01', 'q1', new Date('2026-11-29T05:00:00Z'))
  const after = await store.addStamp('judge01', 'q1', new Date('2026-11-29T05:10:00Z'))
  assert.equal(after.length, 1)
  assert.equal(after[0].at, '2026-11-29T05:00:00.000Z')
})

test('저장소를 새로 열어도 도장과 프로필이 남는다 (P-02)', async () => {
  const storage = memoryStorage()
  const a = createLocalStore(storage, accounts)
  await a.addStamp('judge01', 'q2', new Date('2026-11-29T05:00:00Z'))
  await a.saveProfile('judge01', { animal: 'tiger', koreanName: '양자' })
  const b = createLocalStore(storage, accounts)
  assert.deepEqual((await b.getStamps('judge01')).map((s) => s.phraseId), ['q2'])
  assert.deepEqual(await b.getProfile('judge01'), { animal: 'tiger', koreanName: '양자' })
})

test('계정 A의 도장은 계정 B에서 보이지 않는다 (P-03)', async () => {
  const store = createLocalStore(memoryStorage(), accounts)
  await store.addStamp('judge01', 'q1')
  assert.deepEqual(await store.getStamps('judge02'), [])
  assert.deepEqual(await store.getProfile('judge02'), { animal: null, koreanName: null })
})

test('로그인: 맞는 비밀번호만 통과한다', async () => {
  const store = createLocalStore(memoryStorage(), accounts)
  assert.deepEqual(await store.login('judge01', '1111'), { accountId: 'judge01' })
  assert.equal(await store.login('judge01', '9999'), null)
  assert.equal(await store.login('nobody', '1111'), null)
  assert.deepEqual(await store.login(' Judge01 ', '1111'), { accountId: 'judge01' })
})

test('로그인: 전각 아이디·비밀번호와 끝 공백도 통과한다', async () => {
  const judge = accounts[0]
  const fullWidth = (s: string) => s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
  const store = createLocalStore(memoryStorage(), accounts)
  assert.equal(fullWidth(judge.id), 'ｊｕｄｇｅ０１')
  assert.deepEqual(await store.login(fullWidth(judge.id), fullWidth(judge.password)), { accountId: 'judge01' })
  assert.deepEqual(await store.login('judge01', `${judge.password} `), { accountId: 'judge01' })
  assert.deepEqual(await store.login('ＪＵＤＧＥ０１', judge.password), { accountId: 'judge01' })
  assert.equal(await store.login(fullWidth(judge.id), fullWidth('0000')), null)
})

test('저장된 도장 중 시각이 날짜가 아닌 것은 읽을 때 버린다', async () => {
  const storage = memoryStorage()
  storage.setItem(
    'ichimadi:judge01:stamps',
    JSON.stringify([
      { phraseId: 'q1', at: 'not-a-date' },
      { phraseId: 'q2', at: '2026-11-29T05:00:00.000Z' },
      { phraseId: 'q3', at: '' },
    ]),
  )
  const store = createLocalStore(storage, accounts)
  assert.deepEqual(await store.getStamps('judge01'), [{ phraseId: 'q2', at: '2026-11-29T05:00:00.000Z' }])
  const after = await store.addStamp('judge01', 'q1', new Date('2026-11-29T06:00:00Z'))
  assert.deepEqual(after.map((s) => s.phraseId), ['q2', 'q1'])
})

test('기기 저장이 막혀 있으면 메모리에 저장해서 앱이 계속 돈다', async () => {
  const blocked = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }
  const throwsOnWrite = () => ({ ...memoryStorage(), setItem: blocked })
  for (const device of [blocked, throwsOnWrite]) {
    const store = createLocalStore(openStorage(device), accounts)
    await store.addStamp('judge01', 'q1', new Date('2026-11-29T05:00:00Z'))
    assert.deepEqual((await store.getStamps('judge01')).map((s) => s.phraseId), ['q1'])
  }
})
test('기기 저장이 되면 그 저장을 그대로 쓴다', async () => {
  const device = memoryStorage()
  await createLocalStore(openStorage(() => device), accounts).addStamp('judge01', 'q1')
  assert.deepEqual((await createLocalStore(device, accounts).getStamps('judge01')).map((s) => s.phraseId), ['q1'])
})
