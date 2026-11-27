import type { FirstScreen, Profile } from './types.ts'

export function firstScreen(profile: Profile): FirstScreen {
  return profile.animal !== null && profile.koreanName !== null ? 'board' : 'setup'
}
