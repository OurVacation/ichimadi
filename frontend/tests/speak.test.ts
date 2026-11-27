// W-07 (H-07): 듣기. 가짜 음성 엔진으로 설정값을 본다. 실제 소리는 W-10에서 기기로
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canSpeak, speakKorean } from '../src/core/speak.ts'

function fakeEnv(voices: { lang: string; name: string }[] = []) {
  const spoken: any[] = []
  let cancelled = 0
  class Utterance {
    lang = ''
    rate = 1
    voice: unknown = null
    text: string
    constructor(text: string) {
      this.text = text
    }
  }
  return {
    spoken,
    get cancelled() {
      return cancelled
    },
    env: {
      speechSynthesis: { speak: (u: unknown) => spoken.push(u), cancel: () => void cancelled++, getVoices: () => voices },
      SpeechSynthesisUtterance: Utterance,
    },
  }
}

test('엔진이 없으면 지원 안 함, 읽지 않음', () => {
  assert.equal(canSpeak({}), false)
  assert.equal(speakKorean('안녕하세요', {}), false)
})
test('ko-KR, 속도 0.7로 읽고, 앞에 읽던 것은 멈춘다', () => {
  const f = fakeEnv()
  assert.equal(canSpeak(f.env), true)
  assert.equal(speakKorean('어떤 앱인가요?', f.env), true)
  assert.equal(f.spoken.length, 1)
  assert.equal(f.spoken[0].text, '어떤 앱인가요?')
  assert.equal(f.spoken[0].lang, 'ko-KR')
  assert.equal(f.spoken[0].rate, 0.7)
  assert.equal(f.cancelled, 1)
})
test('한국어 목소리가 있으면 그 목소리를 고른다', () => {
  const ko = { lang: 'ko-KR', name: 'Yuna' }
  const f = fakeEnv([{ lang: 'ja-JP', name: 'Kyoko' }, ko])
  speakKorean('감사합니다', f.env)
  assert.equal(f.spoken[0].voice, ko)
})
