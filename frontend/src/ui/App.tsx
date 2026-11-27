import { useCallback, useEffect, useReducer } from 'react'
import type { Animal, Store } from '../core/types.ts'
import { firstScreen, signIn } from '../core/session.ts'
import { reduce } from './flow.ts'
import { AnimalPick, Board, Book, Card, Login, NamePick, Opening, Partner, Stamped } from './screens.tsx'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** 로그인한 계정을 새로고침 뒤에도 기억한다. 저장 위치는 main.tsx가 정한다. */
export type Session = { load(): string | null; save(accountId: string | null): void }

/** 저장은 store로만 한다 (P-05). 저장이 끝난 결과만 흐름(reduce)에 넣는다. */
export function App({ store, session }: { store: Store; session: Session }) {
  const [state, dispatch] = useReducer(reduce, null)
  const pouchOpened = useCallback(() => dispatch({ type: 'pouchOpened' }), [])

  useEffect(() => {
    const accountId = session.load()
    if (!accountId) return
    let live = true
    Promise.all([store.getProfile(accountId), store.getStamps(accountId)])
      .then(([profile, stamps]) => {
        if (live) dispatch({ type: 'signedIn', accountId, profile, stamps, first: firstScreen(profile) })
      })
      .catch(() => session.save(null))
    return () => {
      live = false
    }
  }, [store, session])

  if (!state) {
    const login = async (id: string, password: string) => {
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
    }
    return <Login onSubmit={login} />
  }

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
    case 'animal':
      return <AnimalPick onPick={(animal: Animal) => saveProfile({ ...profile, animal })} />
    case 'name':
      return (
        <NamePick
          animal={profile.animal}
          onConfirm={(koreanName) => saveProfile({ ...profile, koreanName })}
          onBack={() => dispatch({ type: 'reselectAnimal' })}
        />
      )
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
