// 한마디 카드: 한국어 어절 아래에 가타카나를 짝지어 보여 준다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pairWords } from '../src/core/pairs.ts'

test('어절과 가타카나 덩어리 수가 같으면 차례대로 짝짓는다', () => {
  assert.deepEqual(pairWords('한번 소개해 주세요', 'ハンボン ソゲヘ ジュセヨ'), [
    { ko: '한번', kana: 'ハンボン' },
    { ko: '소개해', kana: 'ソゲヘ' },
    { ko: '주세요', kana: 'ジュセヨ' },
  ])
  assert.deepEqual(pairWords('수고하셨습니다', 'スゴハショッスムニダ'), [{ ko: '수고하셨습니다', kana: 'スゴハショッスムニダ' }])
})
test('가타카나의 「、」 뒤도 나눔 자리로 본다', () => {
  assert.deepEqual(pairWords('네, 보여 드릴게요', 'ネ、ボヨ ドゥリルケヨ'), [
    { ko: '네,', kana: 'ネ、' },
    { ko: '보여', kana: 'ボヨ' },
    { ko: '드릴게요', kana: 'ドゥリルケヨ' },
  ])
})
test('수가 다르면 짝짓지 않는다', () => {
  assert.equal(pairWords('어떤 앱인가요?', 'オットンエビンガヨ?'), null)
  assert.equal(pairWords('발표 잘 봤습니다', 'パルピョ チャル バッ スムニダ'), null)
})
