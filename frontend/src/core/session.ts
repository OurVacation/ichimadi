import type { FirstScreen, Profile, Store } from './types.ts'

/** 설정 화면은 동물과 이름을 한 번에 저장한다. 동물이 있으면 설정이 끝난 것이고, 이름이 null이면 패스한 것이다. */
export function firstScreen(profile: Profile): FirstScreen {
  return profile.animal !== null ? 'board' : 'setup'
}

export async function signIn(
  store: Store,
  id: string,
  password: string,
): Promise<{ accountId: string; screen: FirstScreen } | null> {
  const session = await store.login(id, password)
  if (!session) return null
  return { accountId: session.accountId, screen: firstScreen(await store.getProfile(session.accountId)) }
}
