import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { NameGenerator, PhraseSource, Store } from '../core/types.ts'
import { errorMessage } from '../api/client.ts'
import type { LoginHash } from '../core/loginHash.ts'
import { JA } from '../i18n.ts'
import { firstScreen } from '../core/session.ts'
import { createEnterGate } from './enterGate.ts'
import { reduce } from './flow.ts'
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
  session,
  qrLogin,
  generateNames,
  loadPhrases,
}: {
  store: Store
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

  const signOut = useCallback(() => {
    gate.cancel()
    session.save(null)
    setFailedLoad(null)
    setRestoring(false)
    dispatch({ type: 'signOut' })
  }, [session, gate])

  useEffect(
    () =>
      session.onExpired?.(() => {
        gate.cancel()
        setFailedLoad(null)
        setRestoring(false)
        setNotice(JA.login.expired)
        dispatch({ type: 'signOut' })
      }),
    [session, gate],
  )

  /** 한마디판에 필요한 것(내 정보, 도장, 한마디)을 한 번에 받아 들어간다. 한마디는 이때만 받는다 */
  const enter = useCallback(
    async (accountId: string) => {
      const current = gate.begin(accountId)
      try {
        const [profile, stamps, phrases] = await Promise.all([store.getProfile(accountId), store.getStamps(accountId), loadPhrases()])
        if (!current()) return
        setFailedLoad(null)
        dispatch({ type: 'signedIn', accountId, profile, stamps, phrases, first: firstScreen(profile) })
      } catch (e) {
        // 로그인이 끊겨서(401) 실패했으면 current()가 false다. 로그인 화면이 맞다
        if (current()) setFailedLoad({ accountId, message: errorMessage(e, JA.load.lead) })
      } finally {
        if (current()) setRestoring(false)
      }
    },
    [store, loadPhrases, gate],
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
      login(qrLogin.id, qrLogin.password).then((message) => {
        setNotice(message)
        if (message) setRestoring(false)
      })
    } else if (qrLogin.kind === 'none') {
      const accountId = session.load()
      if (accountId) enter(accountId)
    }
  }, [session, qrLogin, login, enter])

  if (failedLoad) return <LoadFailed message={failedLoad.message} onRetry={() => enter(failedLoad.accountId)} onLogout={signOut} />
  if (!state) return restoring ? <Loading /> : <Login onSubmit={login} notice={notice} />

  const { accountId, profile, stamps, phrases, screen } = state

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
          onOpen={(phrase) => dispatch({ type: 'openPouch', phrase, instant: reducedMotion() })}
          onBook={() => dispatch({ type: 'toBook' })}
          onLogout={signOut}
        />
      )
    case 'opening':
      return <Opening onOpened={pouchOpened} />
    case 'card':
      return <Card phrase={screen.phrase} onSaid={() => dispatch({ type: 'said' })} onBack={() => dispatch({ type: 'toBoard' })} />
    case 'partner':
      return (
        <Partner
          phrase={screen.phrase}
          onAgain={() => dispatch({ type: 'again' })}
          onOk={async () => {
            try {
              const next = await store.addStamp(accountId, screen.phrase.id)
              dispatch({ type: 'stamped', stamps: next })
              return null
            } catch (e) {
              return errorMessage(e)
            }
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
        />
      )
  }
}
