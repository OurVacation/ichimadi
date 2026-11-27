type Voice = { lang: string }
type Utterance = { lang: string; rate: number; voice: Voice | null }

export type SpeechEnv = {
  speechSynthesis?: { speak(u: Utterance): void; cancel(): void; getVoices(): Voice[] }
  SpeechSynthesisUtterance?: new (text: string) => Utterance
}

const browser = globalThis as unknown as SpeechEnv

export function canSpeak(env: SpeechEnv = browser): boolean {
  return Boolean(env.speechSynthesis && env.SpeechSynthesisUtterance)
}

export function speakKorean(text: string, env: SpeechEnv = browser): boolean {
  const { speechSynthesis, SpeechSynthesisUtterance } = env
  if (!speechSynthesis || !SpeechSynthesisUtterance) return false
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'
  utterance.rate = 0.85
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ko'))
  if (voice) utterance.voice = voice
  speechSynthesis.speak(utterance)
  return true
}
