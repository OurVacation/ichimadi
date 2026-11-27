// 서버에서 받는 것: 한국식 이름 후보(안 되면 임시 규칙), 한마디 목록(기기에 남겨 두고 안 되면 그것을 씀)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApiClient } from '../src/api/client.ts'
import { createApiNameGenerator } from '../src/api/names.ts'
import { createApiPhraseSource } from '../src/api/phrases.ts'
import type { NameGenerator } from '../src/core/types.ts'
import { fakeFetch, memoryStorage, type Call } from './helpers.ts'

type Reply = (call: Call) => [number, unknown] | 'hang' | 'offline'
const clientWith = (reply: Reply, storage = memoryStorage()) => {
  const f = fakeFetch(reply)
  return { client: createApiClient({ fetch: f.fetch, storage }), calls: f.calls, storage }
}

// ---------- 이름 후보 ----------

const FALLBACK = [{ name: '양자', note: 'お名前の読み' }]
const fallback: NameGenerator = async () => FALLBACK
const SERVER = {
  candidates: [
    { name: '전양자', note: '「田」と「陽子」の韓国語読み' },
    { name: '전요코', note: '「田」を韓国の姓に、名前は音のまま' },
    { name: '전서연', note: '「陽子」の明るい印象に近い韓国の名前' },
  ],
}

test('이름 후보: 성명 전체를 ja_name으로 보내고 서버 후보를 그대로 돌려준다', async () => {
  const { client, calls } = clientWith(() => [200, SERVER])
  assert.deepEqual(await createApiNameGenerator(client, fallback)('田中 陽子'), SERVER.candidates)
  assert.equal(calls[0].url, '/api/names/suggest')
  assert.deepEqual(calls[0].body, { ja_name: '田中 陽子' })
})

test('이름 후보: 503, 통신 실패, 이상한 응답이면 임시 규칙으로 대신한다', async () => {
  const replies: Reply[] = [
    () => [503, { code: 'name_suggest_unavailable', message_ja: 'いまは候補を作れません' }],
    () => 'offline',
    () => [502, '<html>Bad Gateway</html>'],
    () => [200, { candidates: [{ name: 'Yoko', note: 'x' }] }],
  ]
  for (const reply of replies) {
    const { client } = clientWith(reply)
    assert.deepEqual(await createApiNameGenerator(client, fallback)('田中 陽子'), FALLBACK)
  }
})

test('이름 후보: 3초 안에 답이 없으면 끊고 임시 규칙으로 대신한다', { timeout: 6000 }, async () => {
  const { client } = clientWith(() => 'hang')
  const started = Date.now()
  assert.deepEqual(await createApiNameGenerator(client, fallback)('田中 陽子'), FALLBACK)
  const waited = Date.now() - started
  assert.ok(waited >= 2900 && waited < 4000, `${waited}ms`)
})

test('이름 후보: 422(입력 확인)는 대신하지 않고 그대로 알린다', async () => {
  const { client } = clientWith(() => [422, { code: 'invalid_ja_name', message_ja: '名前を確認してください' }])
  await assert.rejects(createApiNameGenerator(client, fallback)('x'.repeat(40)), (e) => e instanceof ApiError && e.code === 'invalid_ja_name')
})

// ---------- 한마디 ----------

const ITEM = {
  id: 'q1',
  set_code: 'hackathon',
  label: 'はじめまして',
  ko: '어떤 앱인가요?',
  kana: 'オットン エビンガヨ?',
  ja: 'どんなアプリですか？',
  when: '他のチームのブースに初めて行ったとき',
  reply: '일본인을 위한 ○○ 앱이에요',
  reply_kana: 'イルボニヌル ウィハン ○○ エビエヨ',
  reply_ja: '日本人のための○○アプリです',
}
const PHRASE = {
  id: 'q1',
  label: 'はじめまして',
  ko: '어떤 앱인가요?',
  kana: 'オットン エビンガヨ?',
  ja: 'どんなアプリですか？',
  when: '他のチームのブースに初めて行ったとき',
  reply: '일본인을 위한 ○○ 앱이에요',
  replyKana: 'イルボニヌル ウィハン ○○ エビエヨ',
  replyJa: '日本人のための○○アプリです',
}

test('한마디: set_code=hackathon으로 받아 Phrase 모양(replyKana, replyJa)으로 바꾼다', async () => {
  const { client, calls } = clientWith(() => [200, { phrases: [ITEM, { ...ITEM, id: 'q2' }] }])
  assert.deepEqual(await createApiPhraseSource(client, memoryStorage())(), [PHRASE, { ...PHRASE, id: 'q2' }])
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].url, '/api/phrases?set_code=hackathon')
})

test('한마디: 받은 것을 기기에 남기고, 다음에 서버가 안 되면 남긴 것을 쓴다', async () => {
  const storage = memoryStorage()
  let up = true
  const { client } = clientWith(() => (up ? [200, { phrases: [ITEM] }] : 'offline'), storage)
  const load = createApiPhraseSource(client, storage)
  assert.deepEqual(await load(), [PHRASE])
  up = false
  assert.deepEqual(await load(), [PHRASE])
  // 새로고침 뒤(새 소스)에도 남아 있다
  assert.deepEqual(await createApiPhraseSource(client, storage)(), [PHRASE])
})

test('한마디: 서버가 안 되고 남긴 것도 없으면 거절한다 (화면이 다시 시도하게 한다)', async () => {
  const replies: Reply[] = [() => 'offline', () => 'hang', () => [500, 'oops'], () => [404, { code: 'unknown_phrase_set', message_ja: 'x' }]]
  for (const reply of replies) {
    const storage = memoryStorage()
    const client = createApiClient({ fetch: fakeFetch(reply).fetch, storage, timeoutMs: 20 })
    await assert.rejects(createApiPhraseSource(client, storage)(), ApiError)
  }
})

test('한마디: 빈 목록이나 칸이 빠진 응답은 쓰지 않고 남긴 것을 쓴다. 망가진 캐시는 없는 것과 같다', async () => {
  const storage = memoryStorage()
  storage.setItem('ichimadi:phrases:hackathon', JSON.stringify([PHRASE]))
  const { reply_kana: _drop, ...missing } = ITEM
  for (const body of [{ phrases: [] }, { phrases: [missing] }, { nope: 1 }]) {
    const { client } = clientWith(() => [200, body], storage)
    assert.deepEqual(await createApiPhraseSource(client, storage)(), [PHRASE])
  }
  storage.setItem('ichimadi:phrases:hackathon', '{broken')
  const { client } = clientWith(() => [200, { phrases: [] }], storage)
  await assert.rejects(createApiPhraseSource(client, storage)(), (e) => e instanceof ApiError && e.code === 'bad_response')
})
