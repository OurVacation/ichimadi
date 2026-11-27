// 서버 연결: fetch 감싸개(에러 모양, 시간 초과)와 서버 Store(모양 바꾸기, 토큰 유지·401)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApiClient, errorMessage } from '../src/api/client.ts'
import { createApiStore } from '../src/api/store.ts'
import { JA } from '../src/i18n.ts'
import { fakeFetch, memoryStorage, type Call } from './helpers.ts'

const ok = (body: unknown): [number, unknown] => [200, body]
const anything = (v: unknown) => v

async function rejection(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ApiError, String(e))
    return e
  }
  assert.fail('거절되지 않았다')
}

// ---------- fetch 감싸개 ----------

test('같은 출처 /api로 JSON을 보내고 받는다', async () => {
  const f = fakeFetch(() => ok({ status: 'ok' }))
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage() })
  assert.deepEqual(await client.request('POST', '/x', { body: { a: 1 }, parse: anything }), { status: 'ok' })
  assert.equal(f.calls[0].url, '/api/x')
  assert.equal(f.calls[0].method, 'POST')
  assert.equal(f.calls[0].headers['Content-Type'], 'application/json')
  assert.deepEqual(f.calls[0].body, { a: 1 })
})

test('2xx가 아니면 본문의 {code, message_ja}를 ApiError로 돌려준다', async () => {
  const f = fakeFetch(() => [404, { code: 'unknown_phrase', message_ja: 'この一言は見つかりませんでした' }])
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage() })
  const e = await rejection(client.request('GET', '/x', { parse: anything }))
  assert.deepEqual([e.status, e.code, e.messageJa], [404, 'unknown_phrase', 'この一言は見つかりませんでした'])
})

test('에러 본문이 그 모양이 아니면(프록시의 HTML 등) http_error와 일본어 안내', async () => {
  const f = fakeFetch(() => [502, '<html>Bad Gateway</html>'])
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage() })
  const e = await rejection(client.request('GET', '/x', { parse: anything }))
  assert.deepEqual([e.status, e.code, e.messageJa], [502, 'http_error', JA.error])
})

test('통신이 안 되면 network_error, status 0, 일본어 안내', async () => {
  const f = fakeFetch(() => 'offline')
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage() })
  const e = await rejection(client.request('GET', '/x', { parse: anything }))
  assert.deepEqual([e.status, e.code, e.messageJa], [0, 'network_error', JA.network.offline])
})

test('시간 안에 답이 없으면 요청을 끊고 timeout', async () => {
  const f = fakeFetch(() => 'hang')
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage(), timeoutMs: 20 })
  const started = Date.now()
  const e = await rejection(client.request('GET', '/x', { parse: anything }))
  assert.deepEqual([e.status, e.code, e.messageJa], [0, 'timeout', JA.network.timeout])
  assert.ok(Date.now() - started < 1000)
})

test('요청마다 시간 제한을 따로 줄 수 있다', async () => {
  const f = fakeFetch(() => 'hang')
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage(), timeoutMs: 60_000 })
  const e = await rejection(client.request('GET', '/x', { parse: anything, timeoutMs: 20 }))
  assert.equal(e.code, 'timeout')
})

test('200이어도 응답 모양이 다르면 bad_response', async () => {
  const f = fakeFetch(() => ok({ unexpected: true }))
  const client = createApiClient({ fetch: f.fetch, storage: memoryStorage() })
  const e = await rejection(client.request('GET', '/x', { parse: () => null }))
  assert.deepEqual([e.status, e.code], [200, 'bad_response'])
})

// ---------- 서버 Store ----------

const LOGIN_OK = { access_token: 'tok-1', token_type: 'bearer', account_id: 'j01', expires_in: 259200 }
const STAMPS = {
  stamps: [
    { phrase_id: 'q1', set_code: 'hackathon', stamped_at: '2026-11-29T05:00:00Z' },
    { phrase_id: 'q3', set_code: 'hackathon', stamped_at: '2026-11-29T05:04:12Z' },
  ],
  progress: [{ set_code: 'hackathon', count: 2, total: 6, completed: false }],
}

/** 로그인과 /me, /me/stamps에 답하는 가짜 서버. me는 테스트가 바꾼다 */
function server(me: { animal: string | null; korean_name: string | null } = { animal: null, korean_name: null }) {
  return fakeFetch((c: Call) => {
    if (c.url === '/api/auth/login') {
      const body = c.body as { login_id: string; password: string }
      return body.password === '4821' ? ok(LOGIN_OK) : [401, { code: 'invalid_credentials', message_ja: 'IDかパスワードが違います' }]
    }
    if (c.headers.Authorization !== 'Bearer tok-1') return [401, { code: 'unauthorized', message_ja: 'ログインが必要です。' }]
    if (c.url === '/api/me') return ok({ account_id: 'j01', ...me })
    if (c.url === '/api/me/profile') return ok({ account_id: 'j01', ...(c.body as object) })
    if (c.url === '/api/me/stamps') return ok(STAMPS)
    return [404, { code: 'not_found', message_ja: '見つかりません' }]
  })
}

test('login: 서버에 login_id·password를 보내고 account_id를 돌려준다. 틀리면 null', async () => {
  const f = server()
  const store = createApiStore(createApiClient({ fetch: f.fetch, storage: memoryStorage() }))
  assert.deepEqual(await store.login('ｊ０１ ', '4821'), { accountId: 'j01' })
  assert.deepEqual(f.calls[0].body, { login_id: 'ｊ０１ ', password: '4821' })
  assert.equal(f.calls[0].headers.Authorization, undefined)
  assert.equal(await store.login('j01', '0000'), null)
})

test('login: 401이 아닌 실패(통신 등)는 null이 아니라 던진다', async () => {
  const f = fakeFetch(() => 'offline')
  const store = createApiStore(createApiClient({ fetch: f.fetch, storage: memoryStorage() }))
  assert.equal((await rejection(store.login('j01', '4821'))).code, 'network_error')
})

test('getProfile: animal·korean_name을 그대로 옮긴다 (null 미정, "" 이름 패스, 이름)', async () => {
  for (const [animal, korean_name] of [
    [null, null],
    ['tiger', ''],
    ['rabbit', '양자'],
  ] as const) {
    const store = createApiStore(createApiClient({ fetch: server({ animal, korean_name }).fetch, storage: memoryStorage() }))
    await store.login('j01', '4821')
    assert.deepEqual(await store.getProfile('j01'), { animal, koreanName: korean_name })
  }
})

test('getProfile: 모르는 동물은 받아들이지 않는다', async () => {
  const store = createApiStore(createApiClient({ fetch: server({ animal: 'cat', korean_name: null }).fetch, storage: memoryStorage() }))
  await store.login('j01', '4821')
  assert.equal((await rejection(store.getProfile('j01'))).code, 'bad_response')
})

test('saveProfile: animal·korean_name으로 PUT. 빈 이름("")과 null도 그대로 보낸다', async () => {
  const f = server()
  const store = createApiStore(createApiClient({ fetch: f.fetch, storage: memoryStorage() }))
  await store.login('j01', '4821')
  await store.saveProfile('j01', { animal: 'tiger', koreanName: '' })
  await store.saveProfile('j01', { animal: 'bear', koreanName: '양자' })
  await store.saveProfile('j01', { animal: null, koreanName: null })
  const puts = f.calls.filter((c) => c.method === 'PUT')
  assert.deepEqual(
    puts.map((c) => [c.url, c.body]),
    [
      ['/api/me/profile', { animal: 'tiger', korean_name: '' }],
      ['/api/me/profile', { animal: 'bear', korean_name: '양자' }],
      ['/api/me/profile', { animal: null, korean_name: null }],
    ],
  )
})

test('getStamps·addStamp: phrase_id·stamped_at을 phraseId·at으로. addStamp는 phrase_id만 보낸다', async () => {
  const f = server()
  const store = createApiStore(createApiClient({ fetch: f.fetch, storage: memoryStorage() }))
  await store.login('j01', '4821')
  const expected = [
    { phraseId: 'q1', at: '2026-11-29T05:00:00Z' },
    { phraseId: 'q3', at: '2026-11-29T05:04:12Z' },
  ]
  assert.deepEqual(await store.getStamps('j01'), expected)
  assert.deepEqual(await store.addStamp('j01', 'q3', new Date('2020-01-01T00:00:00Z')), expected)
  const post = f.calls.find((c) => c.method === 'POST' && c.url === '/api/me/stamps')
  assert.deepEqual(post?.body, { phrase_id: 'q3' })
})

test('로그인 토큰은 저장소에 남아 새로 연 클라이언트(새로고침)도 로그인 상태다', async () => {
  const storage = memoryStorage()
  const f = server({ animal: 'tiger', korean_name: '양자' })
  await createApiStore(createApiClient({ fetch: f.fetch, storage })).login('j01', '4821')

  const reopened = createApiClient({ fetch: f.fetch, storage })
  assert.equal(reopened.accountId(), 'j01')
  assert.deepEqual(await createApiStore(reopened).getProfile('j01'), { animal: 'tiger', koreanName: '양자' })
  assert.equal(f.calls.at(-1)?.headers.Authorization, 'Bearer tok-1')
})

test('토큰을 보낸 요청이 401이면 토큰을 지우고 알린다. 새로고침 뒤에도 로그아웃 상태', async () => {
  const storage = memoryStorage()
  storage.setItem('ichimadi:auth', JSON.stringify({ token: 'expired', accountId: 'j01' }))
  const client = createApiClient({ fetch: server().fetch, storage })
  let notified = 0
  client.onUnauthorized(() => notified++)

  const e = await rejection(createApiStore(client).getStamps('j01'))
  assert.deepEqual([e.status, e.code], [401, 'unauthorized'])
  assert.equal(notified, 1)
  assert.equal(client.accountId(), null)
  assert.equal(createApiClient({ fetch: server().fetch, storage }).accountId(), null)
})

test('login: 요청 전에 이전 로그인을 지운다. 실패(틀림·통신)해도 이전 계정으로 돌아가지 않는다', async () => {
  for (const reply of [() => [401, { code: 'invalid_credentials', message_ja: 'IDかパスワードが違います' }], () => 'offline'] as const) {
    const storage = memoryStorage()
    storage.setItem('ichimadi:auth', JSON.stringify({ token: 'tok-a', accountId: 'a01' }))
    const f = fakeFetch(reply as () => [number, unknown] | 'offline')
    const client = createApiClient({ fetch: f.fetch, storage })
    await createApiStore(client).login('b01', '1234').catch(() => null)
    assert.equal(client.accountId(), null)
    assert.equal(createApiClient({ fetch: f.fetch, storage }).accountId(), null)
  }
})

test('로그인 실패(401)는 로그인 끊김 알림을 부르지 않는다', async () => {
  const client = createApiClient({ fetch: server().fetch, storage: memoryStorage() })
  let notified = 0
  client.onUnauthorized(() => notified++)
  assert.equal(await createApiStore(client).login('j01', '0000'), null)
  assert.equal(notified, 0)
})

test('망가진 저장 토큰은 로그인 안 한 것으로 본다', () => {
  for (const raw of ['{', '"tok"', JSON.stringify({ token: '', accountId: 'j01' }), JSON.stringify({ token: 1 })]) {
    const storage = memoryStorage()
    storage.setItem('ichimadi:auth', raw)
    assert.equal(createApiClient({ fetch: server().fetch, storage }).accountId(), null, raw)
  }
})

test('늦게 온 지난 계정 요청의 401은 그 사이에 로그인한 다른 계정을 로그아웃시키지 않는다', async () => {
  let release: () => void = () => {}
  const late = new Promise<void>((r) => (release = r))
  const fetch = (async (_input: string | URL | Request, init: RequestInit = {}) => {
    const auth = (init.headers as Record<string, string>).Authorization
    if (auth === 'Bearer tok-a') {
      await late
      return new Response(JSON.stringify({ code: 'unauthorized', message_ja: 'ログインが必要です。' }), { status: 401 })
    }
    return new Response(JSON.stringify({ stamps: [], progress: [] }), { status: 200 })
  }) as typeof globalThis.fetch
  const client = createApiClient({ fetch, storage: memoryStorage() })
  let notified = 0
  client.onUnauthorized(() => notified++)
  client.saveAuth('tok-a', 'a01')
  const stale = client.request('GET', '/me/stamps', { parse: anything })
  client.saveAuth('tok-b', 'b01')
  release()
  assert.equal((await rejection(stale)).status, 401)
  assert.equal(client.accountId(), 'b01')
  assert.equal(notified, 0)
})

test('화면 문구: 서버 에러는 message_ja, 통신 실패·시간 초과는 일본어 안내, 그 밖은 일반 문구', async () => {
  const serverError = await rejection(
    createApiClient({ fetch: fakeFetch(() => [404, { code: 'unknown_phrase', message_ja: 'この一言は見つかりませんでした' }]).fetch, storage: memoryStorage() }).request('GET', '/x', { parse: anything }),
  )
  const offline = await rejection(createApiClient({ fetch: fakeFetch(() => 'offline').fetch, storage: memoryStorage() }).request('GET', '/x', { parse: anything }))
  const timeout = await rejection(
    createApiClient({ fetch: fakeFetch(() => 'hang').fetch, storage: memoryStorage(), timeoutMs: 20 }).request('GET', '/x', { parse: anything }),
  )
  assert.equal(errorMessage(serverError), 'この一言は見つかりませんでした')
  assert.equal(errorMessage(offline), JA.network.offline)
  assert.equal(errorMessage(timeout), JA.network.timeout)
  assert.equal(errorMessage(new Error('local')), JA.error)
  assert.equal(errorMessage(new Error('local'), JA.load.lead), JA.load.lead)
})
