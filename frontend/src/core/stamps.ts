import type { Stamp } from './types.ts'

export function bookProgress(stamps: Stamp[], phrases: { id: string }[]) {
  const known = new Set(phrases.map((p) => p.id))
  const count = new Set(stamps.map((s) => s.phraseId).filter((id) => known.has(id))).size
  return { count, total: phrases.length, complete: count === phrases.length }
}

export function formatStampTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
