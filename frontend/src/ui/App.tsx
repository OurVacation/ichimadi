import { useCallback, useEffect, useReducer, useState } from 'react'
import type { NameGenerator, Store } from '../core/types.ts'
import type { LoginHash } from '../core/loginHash.ts'
import { firstScreen, signIn } from '../core/session.ts'
import { reduce } from './flow.ts'
import { Board, Book, Card, Login, Opening, Partner, Setup, Stamped, type LoginNotice } from './screens.tsx'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** 로그인한 계정을 새로고침 뒤에도 기억한다. 저장 위치는 main.tsx가 정한다. */
export type Session = { load(): string | null; save(accountId: string | null): void }

/** 저장은 store로만 한다 (P-05). 저장이 끝난 결과만 흐름(reduce)에 넣는다. */
export function App({
  store,
  session,
  qrLogin,
  generateNames,
}: {
  store: Store
  session: Session
  qrLogin: LoginHash
  generateNames: NameGenerator
}) {
  const [state, dispatch] = useReducer(reduce, null)
  const [notice, setNotice] = useState<LoginNotice>(qrLogin.kind === 'login' ? 'checking' : qrLogin.kind === 'malformed' ? 'qrBroken' : 'none')
  const pouchOpened = useCallback(() => dispatch({ type: 'pouchOpened' }), [])

  const login = useCallback(
    async (id: string, password: string) => {
      try {
        const r = await signIn(store, id, password)
        if (!r) return 'failed' as const
        session.save(r.accountId)
        const [profile, stamps] = await Promise.all([store.getProfile(r.accountId), store.getStamps(r.accountId)])
        dispatch({ type: 'signedIn', accountId: r.accountId, profile, stamps, first: r.screen })
        return 'ok' as const
      } catch {
        return 'error' as const
      }
    },
    [store, session],
  )

  useEffect(() => {
    let live = true
    // QR 카드로 열었으면 저장된 로그인보다 카드의 계정이 먼저다
    if (qrLogin.kind === 'login') {
      login(qrLogin.id, qrLogin.password).then((r) => {
        if (live) setNotice(r === 'ok' ? 'none' : r)
      })
    } else {
      const accountId = session.load()
      if (accountId) {
        Promise.all([store.getProfile(accountId), store.getStamps(accountId)])
          .then(([profile, stamps]) => {
            if (live) dispatch({ type: 'signedIn', accountId, profile, stamps, first: firstScreen(profile) })
          })
          .catch(() => session.save(null))
      }
    }
    return () => {
      live = false
    }
  }, [store, session, qrLogin, login])

  if (!state) return <Login onSubmit={login} notice={notice} />

  const { accountId, profile, stamps, screen } = state

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
          onOpen={(phrase) => dispatch({ type: 'openPouch', phrase, instant: reducedMotion() })}
          onBook={() => dispatch({ type: 'toBook' })}
          onLogout={() => {
            session.save(null)
            dispatch({ type: 'signOut' })
          }}
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
          onBook={() => dispatch({ type: 'toBook' })}
          onBoard={() => dispatch({ type: 'toBoard' })}
        />
      )
    case 'book':
      return (
        <Book
          profile={profile}
          stamps={stamps}
          closed={screen.closed}
          onClose={() => dispatch({ type: 'closeBook' })}
          onReopen={() => dispatch({ type: 'openBook' })}
          onBack={() => dispatch({ type: 'toBoard' })}
        />
      )
  }
}
