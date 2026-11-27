import type { FirstScreen, Profile, Store } from './types.ts'

export function firstScreen(profile: Profile): FirstScreen {
  return profile.animal !== null && profile.koreanName !== null ? 'board' : 'setup'
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
