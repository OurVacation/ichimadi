// 도장 보낼 목록: 화면은 먼저 찍고, 못 보낸 것은 계정별로 모았다가 다시 보낸다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApiClient } from '../src/api/client.ts'
import { createApiStore } from '../src/api/store.ts'
import { createStampOutbox, RETRY_MS, withPending, type OutboxEvent } from '../src/api/stampOutbox.ts'
import { fakeFetch, memoryStorage, type Call } from './helpers.ts'

type Reply = [number, unknown] | 'hang' | 'offline'

/** 가짜 서버 + 진짜 client/store로 만든 보낼 목록. reply로 서버 상태를 바꾼다 */
function setup(account = 'j01') {
  const storage = memoryStorage()
  const saved = new Map<string, string>()
  let reply: (c: Call) => Reply = (c) => {
    const id = (c.body as { phrase_id: string }).phrase_id
    if (!saved.has(id)) saved.set(id, `2026-11-29T05:0${saved.size}:00Z`)
    return [200, { stamps: [...saved].map(([phrase_id, stamped_at]) => ({ phrase_id, set_code: 'hackathon', stamped_at })), progress: [] }]
  }
  const f = fakeFetch((c) => reply(c))
  const client = createApiClient({ fetch: f.fetch, storage, timeoutMs: 20 })
  client.saveAuth('tok', account)
  const store = createApiStore(client)
  let online = () => {}
  const timers = { created: 0, cleared: 0, live: null as null | (() => void) }
  const outbox = createStampOutbox({
    storage,
    send: store.addStamp,
    currentAccount: () => client.accountId(),
    onOnline: (l) => ((online = l), () => {}),
    timers: {
      setInterval(fn: () => void, ms: number) {
        assert.equal(ms, RETRY_MS)
        timers.created++
        timers.live = fn
        return timers.created
      },
      clearInterval() {
        timers.cleared++
        timers.live = null
      },
    },
  })
  const events: OutboxEvent[] = []
  outbox.subscribe((e) => events.push(e))
  return {
    storage,
    client,
    outbox,
    events,
    calls: f.calls,
    timers,
    goOnline: () => online(),
    setReply: (r: (c: Call) => Reply) => (reply = r),
    serverStamps: () => [...saved.keys()],
  }
}

const at = new Date('2026-11-29T05:00:00Z')
const settle = () => new Promise((r) => setTimeout(r, 0))

test('넣으면 계정별 키에 한마디 id와 시각을 남긴다. 같은 한마디는 한 번만', () => {
  const t = setup()
  t.setReply(() => 'offline')
  t.outbox.add('j01', 'q1', at)
  t.outbox.add('j01', 'q1', new Date('2026-11-29T06:00:00Z'))
  assert.deepEqual(t.outbox.pending('j01'), [{ phraseId: 'q1', at: '2026-11-29T05:00:00.000Z' }])
  assert.deepEqual(JSON.parse(t.storage.getItem('ichimadi:j01:pendingStamps')!), [{ phraseId: 'q1', at: '2026-11-29T05:00:00.000Z' }])
})

test('보내기 성공: 목록에서 빼고 서버가 준 도장 목록(서버 시각)을 알린다', async () => {
  const t = setup()
  t.outbox.add('j01', 'q1', at)
  await t.outbox.flush('j01')
  assert.deepEqual(t.outbox.pending('j01'), [])
  assert.equal(t.storage.getItem('ichimadi:j01:pendingStamps'), null)
  assert.deepEqual(t.events, [{ kind: 'synced', accountId: 'j01', stamps: [{ phraseId: 'q1', at: '2026-11-29T05:00:00Z' }] }])
  assert.deepEqual(t.calls.map((c) => [c.method, c.url, c.body]), [['POST', '/api/me/stamps', { phrase_id: 'q1' }]])
})

test('통신 실패·시간 초과·5xx·401이면 남겨 둔다', async () => {
  const replies: Reply[] = ['offline', 'hang', [503, { code: 'x', message_ja: 'x' }], [500, 'oops'], [401, { code: 'unauthorized', message_ja: 'ログインが必要です。' }]]
  for (const r of replies) {
    const t = setup()
    t.setReply(() => r)
    t.outbox.add('j01', 'q1', at)
    await t.outbox.flush('j01')
    assert.deepEqual(t.outbox.pending('j01').map((s) => s.phraseId), ['q1'], JSON.stringify(r))
    assert.deepEqual(t.events, [])
  }
})

test('401로 남긴 도장은 같은 계정으로 다시 로그인하면 이어서 보낸다', async () => {
  const t = setup()
  t.setReply(() => [401, { code: 'unauthorized', message_ja: 'ログインが必要です。' }])
  t.outbox.add('j01', 'q1', at)
  await t.outbox.flush('j01')
  assert.equal(t.client.accountId(), null)
  t.setReply((c) => [200, { stamps: [{ phrase_id: (c.body as { phrase_id: string }).phrase_id, set_code: 'hackathon', stamped_at: '2026-11-29T05:00:00Z' }], progress: [] }])
  t.client.saveAuth('tok-2', 'j01')
  t.outbox.start('j01')
  await t.outbox.flush('j01')
  assert.deepEqual(t.outbox.pending('j01'), [])
})

test('온라인이 되면 남긴 것을 다시 보낸다', async () => {
  const t = setup()
  t.setReply(() => 'offline')
  t.outbox.start('j01')
  t.outbox.add('j01', 'q1', at)
  t.outbox.add('j01', 'q2', at)
  await t.outbox.flush('j01')
  assert.equal(t.outbox.pending('j01').length, 2)
  t.setReply((c) => [200, { stamps: [{ phrase_id: (c.body as { phrase_id: string }).phrase_id, set_code: 'hackathon', stamped_at: '2026-11-29T05:00:00Z' }], progress: [] }])
  t.goOnline()
  await t.outbox.flush('j01')
  assert.deepEqual(t.outbox.pending('j01'), [])
  // 첫 번째를 보낸 직후의 목록에도 아직 못 보낸 두 번째가 들어 있다 (화면에서 사라지지 않게)
  assert.deepEqual(
    t.events.map((e) => e.kind === 'synced' && e.stamps.map((s) => s.phraseId)),
    [['q1', 'q2'], ['q2']],
  )
})

test('서버가 없는 한마디(404)라고 하면 버리고 서버 문구와 함께 알린다. 나머지는 계속 보낸다', async () => {
  const t = setup()
  t.setReply(() => 'offline')
  t.outbox.add('j01', 'gone', at)
  t.outbox.add('j01', 'q1', at)
  await t.outbox.flush('j01')
  const ok = (id: string): Reply => [200, { stamps: [{ phrase_id: id, set_code: 'hackathon', stamped_at: '2026-11-29T05:00:00Z' }], progress: [] }]
  t.setReply((c) => {
    const id = (c.body as { phrase_id: string }).phrase_id
    return id === 'gone' ? [404, { code: 'unknown_phrase', message_ja: 'この一言は見つかりませんでした' }] : ok(id)
  })
  await t.outbox.flush('j01')
  assert.deepEqual(t.outbox.pending('j01'), [])
  assert.deepEqual(t.events[0], { kind: 'dropped', accountId: 'j01', phraseId: 'gone', message: 'この一言は見つかりませんでした' })
  assert.equal(t.events[1].kind, 'synced')
})

test('계정별로 따로 둔다. 지금 로그인한 계정이 아니면 그 계정의 도장은 보내지 않는다', async () => {
  const t = setup('j01')
  t.setReply(() => 'offline')
  t.outbox.add('j01', 'q1', at)
  t.client.saveAuth('tok-b', 'j02')
  t.setReply((c) => [200, { stamps: [{ phrase_id: (c.body as { phrase_id: string }).phrase_id, set_code: 'hackathon', stamped_at: '2026-11-29T05:00:00Z' }], progress: [] }])
  const before = t.calls.length
  await t.outbox.flush('j01')
  t.outbox.add('j02', 'q2', at)
  await t.outbox.flush('j02')
  assert.deepEqual(t.outbox.pending('j01').map((s) => s.phraseId), ['q1'])
  assert.deepEqual(t.outbox.pending('j02'), [])
  assert.deepEqual(t.calls.slice(before).map((c) => [c.headers.Authorization, c.body]), [['Bearer tok-b', { phrase_id: 'q2' }]])
})

test('남은 게 있는 동안만 30초 타이머를 두고, 비거나 로그아웃하면 지운다', async () => {
  const t = setup()
  t.setReply(() => 'offline')
  t.outbox.start('j01')
  assert.equal(t.timers.created, 0)
  t.outbox.add('j01', 'q1', at)
  await t.outbox.flush('j01')
  await settle()
  assert.equal(t.timers.created, 1)
  assert.ok(t.timers.live)
  // 타이머가 다시 보내서 성공하면 비었으니 타이머를 지운다
  t.setReply((c) => [200, { stamps: [{ phrase_id: (c.body as { phrase_id: string }).phrase_id, set_code: 'hackathon', stamped_at: '2026-11-29T05:00:00Z' }], progress: [] }])
  t.timers.live!()
  await t.outbox.flush('j01')
  assert.deepEqual(t.outbox.pending('j01'), [])
  assert.equal(t.timers.cleared, 1)
  assert.equal(t.timers.live, null)

  // 로그아웃(stop)하면 남은 게 있어도 타이머를 지운다
  t.setReply(() => 'offline')
  t.outbox.add('j01', 'q2', at)
  await t.outbox.flush('j01')
  assert.ok(t.timers.live)
  t.outbox.stop()
  assert.equal(t.timers.live, null)
  assert.deepEqual(t.outbox.pending('j01').map((s) => s.phraseId), ['q2'])
})

test('망가진 저장 목록은 없는 것과 같다', () => {
  const t = setup()
  for (const raw of ['{', '"x"', JSON.stringify([{ phraseId: 'q1', at: 'not-a-date' }, { phraseId: 1 }])]) {
    t.storage.setItem('ichimadi:j01:pendingStamps', raw)
    assert.deepEqual(t.outbox.pending('j01'), [], raw)
  }
})

test('서버 도장 목록에 아직 못 보낸 도장을 더한다 (같은 한마디는 서버 것)', () => {
  const server = [{ phraseId: 'q1', at: '2026-11-29T05:00:00Z' }]
  assert.deepEqual(
    withPending(server, [
      { phraseId: 'q1', at: '2026-11-29T09:00:00.000Z' },
      { phraseId: 'q2', at: '2026-11-29T09:01:00.000Z' },
    ]),
    [...server, { phraseId: 'q2', at: '2026-11-29T09:01:00.000Z' }],
  )
})
