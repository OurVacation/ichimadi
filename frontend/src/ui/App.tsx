import { useCallback, useEffect, useReducer, useState } from 'react'
import type { NameGenerator, PhraseSource, Store } from '../core/types.ts'
import type { LoginHash } from '../core/loginHash.ts'
import { firstScreen } from '../core/session.ts'
import { reduce } from './flow.ts'
import { Board, Book, Card, LoadFailed, Login, Opening, Partner, Setup, Stamped, type LoginNotice } from './screens.tsx'

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
  const [notice, setNotice] = useState<LoginNotice>(qrLogin.kind === 'login' ? 'checking' : qrLogin.kind === 'malformed' ? 'qrBroken' : 'none')
  /** 로그인은 됐는데 한마디·내 정보를 못 받은 계정. 다시 시도 화면을 보인다 */
  const [failedLoad, setFailedLoad] = useState<string | null>(null)
  const pouchOpened = useCallback(() => dispatch({ type: 'pouchOpened' }), [])

  const signOut = useCallback(() => {
    session.save(null)
    setFailedLoad(null)
    dispatch({ type: 'signOut' })
  }, [session])

  useEffect(
    () =>
      session.onExpired?.(() => {
        setFailedLoad(null)
        setNotice('expired')
        dispatch({ type: 'signOut' })
      }),
    [session],
  )

  /** 한마디판에 필요한 것(내 정보, 도장, 한마디)을 한 번에 받아 들어간다. 한마디는 이때만 받는다 */
  const enter = useCallback(
    async (accountId: string, live: () => boolean = () => true) => {
      try {
        const [profile, stamps, phrases] = await Promise.all([store.getProfile(accountId), store.getStamps(accountId), loadPhrases()])
        if (!live()) return
        setFailedLoad(null)
        dispatch({ type: 'signedIn', accountId, profile, stamps, phrases, first: firstScreen(profile) })
      } catch {
        // 로그인이 끊겨서(401) 실패했으면 로그인 화면이 맞다
        if (live() && session.load() !== null) setFailedLoad(accountId)
      }
    },
    [store, session, loadPhrases],
  )

  const login = useCallback(
    async (id: string, password: string) => {
      try {
        const r = await store.login(id, password)
        if (!r) return 'failed' as const
        session.save(r.accountId)
        await enter(r.accountId)
        return 'ok' as const
      } catch {
        return 'error' as const
      }
    },
    [store, session, enter],
  )

  useEffect(() => {
    let live = true
    // QR 카드로 열었으면 저장된 로그인보다 카드가 먼저다. 깨진 QR이면 로그인 화면에 알림만 둔다
    if (qrLogin.kind === 'login') {
      login(qrLogin.id, qrLogin.password).then((r) => {
        if (live) setNotice(r === 'ok' ? 'none' : r)
      })
    } else if (qrLogin.kind === 'none') {
      const accountId = session.load()
      if (accountId) enter(accountId, () => live)
    }
    return () => {
      live = false
    }
  }, [session, qrLogin, login, enter])

  if (failedLoad) return <LoadFailed onRetry={() => enter(failedLoad)} onLogout={signOut} />
  if (!state) return <Login onSubmit={login} notice={notice} />

  const { accountId, profile, stamps, phrases, screen } = state

  const saveProfile = async (next: typeof profile) => {
    try {
      await store.saveProfile(accountId, next)
      dispatch({ type: 'profileSaved', profile: next })
      return true
    } catch {
      return false
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
              return true
            } catch {
              return false
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
