// 낮(기본)·밤 테마. 고른 테마는 기기에 기억하고 <html data-theme>에 건다 (DESIGN.md §2)
import type { KeyValueStorage } from './store.ts'

export type Theme = 'night' | 'day'

const KEY = 'ichimadi:theme'

export type ThemeControl = {
  get(): Theme
  set(theme: Theme): void
  subscribe(listener: () => void): () => void
}

/** 처음 열면 기기 설정과 상관없이 낮. apply는 화면에 거는 일 (테스트에서는 빼도 된다) */
export function createTheme(storage: KeyValueStorage, apply: (theme: Theme) => void = () => {}): ThemeControl {
  let current: Theme = storage.getItem(KEY) === 'night' ? 'night' : 'day'
  const listeners = new Set<() => void>()
  apply(current)
  return {
    get: () => current,
    set(theme) {
      current = theme
      storage.setItem(KEY, theme)
      apply(theme)
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
