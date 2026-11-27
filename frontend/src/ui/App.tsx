import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { NameGenerator, PhraseSource, Store } from '../core/types.ts'
import { errorMessage } from '../api/client.ts'
import { withPending, type StampOutbox } from '../api/stampOutbox.ts'
import type { LoginHash } from '../core/loginHash.ts'
import { JA } from '../i18n.ts'
import { firstScreen } from '../core/session.ts'
import { createEnterGate } from './enterGate.ts'
import { isDeep, reduce } from './flow.ts'
import { Board, Book, Card, LoadFailed, Loading, Login, Opening, Partner, Setup, Stamped } from './screens.tsx'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 로그인한 계정을 새로고침 뒤에도 기억한다. 저장 위치는 main.tsx가 정한다.
 * onExpired: 서버가 로그인을 끊으면(401) 부른다. 화면은 로그인으로 돌아간다.
 */
export type Session = {
  load(): string | null
  save(accountId: string | null): void
  onExpired?(listener: () => void): () => void
}

/** 저장은 store로만 한다 (P-05). 저장이 끝난 결과만 흐름(reduce)에 넣는다. */
export function App({
  store,
  outbox,
  session,
  qrLogin,
  generateNames,
  loadPhrases,
}: {
  store: Store
  /** 도장 보낼 목록. 화면에 먼저 찍고 저장은 여기서 뒤에 한다 */
  outbox: StampOutbox
  session: Session
  qrLogin: LoginHash
  generateNames: NameGenerator
  loadPhrases: PhraseSource
}) {
  const [state, dispatch] = useReducer(reduce, null)
  /** 로그인 화면 아래 알림 */
  const [notice, setNotice] = useState<string | null>(qrLogin.kind === 'malformed' ? JA.login.qrBroken : null)
  /** 로그인은 됐는데 한마디·내 정보를 못 받은 계정과 그 이유. 다시 시도 화면을 보인다 */
  const [failedLoad, setFailedLoad] = useState<{ accountId: string; message: string } | null>(null)
  /** 저장된 로그인을 되살리거나 QR로 로그인하는 중. 그동안 로그인 폼을 보이지 않는다 (다른 사람이 끼어들지 않게) */
  const [restoring, setRestoring] = useState(() => qrLogin.kind === 'login' || (qrLogin.kind === 'none' && session.load() !== null))
  const gate = useMemo(() => createEnterGate(() => session.load()), [session])
  const handledQr = useRef<LoginHash | null>(null)
  const pouchOpened = useCallback(() => dispatch({ type: 'pouchOpened' }), [])
  /** 깊은 화면용으로 쌓은 브라우저 기록이 있는가, 앱이 스스로 되돌린 뒤로 가기인가 */
  const pushed = useRef(false)
  const ignorePop = useRef(false)

  // 한마디판보다 깊은 화면에 있는 동안 브라우저 기록을 하나 쌓아 둔다. 앱 안 버튼으로 나오면 그 기록을 되돌린다
  const deep = state !== null && isDeep(state.screen)
  useEffect(() => {
    if (deep && !pushed.current) {
      history.pushState({ ichimadi: 'deep' }, '')
      pushed.current = true
    } else if (!deep && pushed.current) {
      pushed.current = false
      ignorePop.current = true
      history.back()
    }
  }, [deep, state?.screen])

  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) {
        ignorePop.current = false
        return
      }
      if (!pushed.current) return
      // 뒤로 가기가 쌓아 둔 기록을 썼다. 한 단계 돌아가고, 아직 깊으면 위 effect가 다시 쌓는다
      pushed.current = false
      dispatch({ type: 'back' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(
    () =>
      outbox.subscribe((e) =>
        dispatch(
          e.kind === 'synced'
            ? { type: 'stampsSynced', accountId: e.accountId, stamps: e.stamps }
            : { type: 'stampDropped', accountId: e.accountId, phraseId: e.phraseId, message: e.message },
        ),
      ),
    [outbox],
  )

  const signOut = useCallback(() => {
    gate.cancel()
    outbox.stop()
    session.save(null)
    setFailedLoad(null)
    setRestoring(false)
    dispatch({ type: 'signOut' })
  }, [session, gate, outbox])

  useEffect(
    () =>
      session.onExpired?.(() => {
        gate.cancel()
        outbox.stop()
        setFailedLoad(null)
        setRestoring(false)
        setNotice(JA.login.expired)
        dispatch({ type: 'signOut' })
      }),
    [session, gate, outbox],
  )

  /** 한마디판에 필요한 것(내 정보, 도장, 한마디)을 한 번에 받아 들어간다. 한마디는 이때만 받는다 */
  const enter = useCallback(
    async (accountId: string) => {
      const current = gate.begin(accountId)
      try {
        const [profile, stamps, phrases] = await Promise.all([store.getProfile(accountId), store.getStamps(accountId), loadPhrases()])
        if (!current()) return
        setFailedLoad(null)
        // 아직 못 보낸 도장도 찍힌 것으로 보이고, 들어오자마자 다시 보낸다
        dispatch({ type: 'signedIn', accountId, profile, stamps: withPending(stamps, outbox.pending(accountId)), phrases, first: firstScreen(profile) })
        outbox.start(accountId)
      } catch (e) {
        // 로그인이 끊겨서(401) 실패했으면 current()가 false다. 로그인 화면이 맞다
        if (current()) setFailedLoad({ accountId, message: errorMessage(e, JA.load.lead) })
      } finally {
        if (current()) setRestoring(false)
      }
    },
    [store, loadPhrases, gate, outbox],
  )

  /** 실패하면 보여 줄 문구, 성공하면 null */
  const login = useCallback(
    async (id: string, password: string): Promise<string | null> => {
      try {
        const r = await store.login(id, password)
        if (!r) return JA.login.failed
        session.save(r.accountId)
        await enter(r.accountId)
        return null
      } catch (e) {
        return errorMessage(e)
      }
    },
    [store, session, enter],
  )

  useEffect(() => {
    // 같은 QR은 한 번만 쓴다 (StrictMode가 effect를 두 번 부른다)
    if (handledQr.current === qrLogin) return
    handledQr.current = qrLogin
    // QR 카드로 열었으면 저장된 로그인보다 카드가 먼저다. 깨진 QR이면 로그인 화면에 알림만 둔다
    if (qrLogin.kind === 'login') {
      // 열린 탭에서 다른 QR을 읽은 경우: 지금 사람을 먼저 내보낸다
      gate.cancel()
      outbox.stop()
      setFailedLoad(null)
      setRestoring(true)
      dispatch({ type: 'signOut' })
      login(qrLogin.id, qrLogin.password).then((message) => {
        setNotice(message)
        if (message) setRestoring(false)
      })
    } else if (qrLogin.kind === 'malformed') {
      setNotice(JA.login.qrBroken)
    } else {
      const accountId = session.load()
      if (accountId) enter(accountId)
    }
  }, [session, qrLogin, login, enter, gate, outbox])

  if (failedLoad) return <LoadFailed message={failedLoad.message} onRetry={() => enter(failedLoad.accountId)} onLogout={signOut} />
  if (!state) return restoring ? <Loading /> : <Login onSubmit={login} notice={notice} />

  const { accountId, profile, stamps, phrases, screen, stampNotice } = state

  const saveProfile = async (next: typeof profile) => {
    try {
      await store.saveProfile(accountId, next)
      dispatch({ type: 'profileSaved', profile: next })
      return null
    } catch (e) {
      return errorMessage(e)
    }
  }

  switch (screen.kind) {
    case 'setup':
      return <Setup generateNames={generateNames} onConfirm={saveProfile} />
    case 'board':
      return (
        <Board
          profile={profile}
          stamps={stamps}
          phrases={phrases}
          pending={outbox.pending(accountId).length}
          notice={stampNotice}
          onOpen={(phrase) => dispatch({ type: 'openPouch', phrase, instant: reducedMotion() })}
          onBook={() => dispatch({ type: 'toBook' })}
        />
      )
    case 'opening':
      return <Opening onOpened={pouchOpened} />
    case 'card':
      return (
        <Card
          phrase={screen.phrase}
          stamp={stamps.find((s) => s.phraseId === screen.phrase.id)}
          onSaid={() => dispatch({ type: 'said' })}
          onBack={() => dispatch({ type: 'toBoard' })}
        />
      )
    case 'partner':
      return (
        <Partner
          phrase={screen.phrase}
          onAgain={() => dispatch({ type: 'again' })}
          onOk={() => {
            const at = new Date()
            dispatch({ type: 'stamped', at: at.toISOString() })
            outbox.add(accountId, screen.phrase.id, at)
          }}
        />
      )
    case 'stamped':
      return (
        <Stamped
          phrase={screen.phrase}
          profile={profile}
          stamps={stamps}
          phrases={phrases}
          onBook={() => dispatch({ type: 'toBook' })}
          onBoard={() => dispatch({ type: 'toBoard' })}
        />
      )
    case 'book':
      return (
        <Book
          profile={profile}
          stamps={stamps}
          phrases={phrases}
          closed={screen.closed}
          onClose={() => dispatch({ type: 'closeBook' })}
          onReopen={() => dispatch({ type: 'openBook' })}
          onBack={() => dispatch({ type: 'toBoard' })}
          onLogout={signOut}
        />
      )
  }
}
