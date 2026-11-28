// 설정 화면의 이름 후보 읽기 (가타카나)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hangulToKatakana } from '../src/core/hangulKana.ts'

test('한국 이름을 가타카나로 읽는다', () => {
  assert.equal(hangulToKatakana('양자'), 'ヤンジャ')
  assert.equal(hangulToKatakana('예준'), 'イェジュン')
  assert.equal(hangulToKatakana('유나'), 'ユナ')
  assert.equal(hangulToKatakana('양태'), 'ヤンテ')
  assert.equal(hangulToKatakana('김민준'), 'キムミンジュン')
  assert.equal(hangulToKatakana('지수'), 'チス')
  assert.equal(hangulToKatakana('서연'), 'ソヨン')
  assert.equal(hangulToKatakana('하은'), 'ハウン')
})
