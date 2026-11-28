// W-04 (H-03): 한국식 이름 후보 (임시 규칙 A-03)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chosenName, hangulName, koreanNameCandidates } from '../src/core/names.ts'

test('한자 이름: 후보 3개, 한국 한자음 읽기가 들어 있다', () => {
  const c = koreanNameCandidates('陽子')
  assert.equal(c.length, 3)
  assert.ok(c.includes('양자'), c.join(','))
})
test('성과 이름을 띄어 쓰면 이름 쪽을 읽는다', () => {
  assert.ok(koreanNameCandidates('田中 陽子').includes('양자'))
})
test('가나 이름: 후보 3개, 소리를 한글로 옮긴 이름이 들어 있다', () => {
  const c = koreanNameCandidates('ようこ')
  assert.equal(c.length, 3)
  assert.ok(c.includes('요코'), c.join(','))
  assert.ok(koreanNameCandidates('ユウキ').includes('유키'))
  assert.ok(koreanNameCandidates('けんた').includes('켄타'))
})
test('후보는 모두 한글이고 겹치지 않는다', () => {
  for (const name of ['陽子', 'ようこ', '翔太', 'さくら']) {
    const c = koreanNameCandidates(name)
    assert.equal(new Set(c).size, c.length)
    for (const n of c) assert.match(n, /^[가-힣]+$/)
  }
})
test('빈 입력이나 읽을 수 없는 입력은 후보 없음', () => {
  assert.deepEqual(koreanNameCandidates(''), [])
  assert.deepEqual(koreanNameCandidates('   '), [])
  assert.deepEqual(koreanNameCandidates('123'), [])
})
test('신자체 한자도 구자체 읽기로 후보 3개 (桜=櫻 앵, 辺=邊 변)', () => {
  const sakurako = koreanNameCandidates('桜子')
  assert.equal(sakurako.length, 3)
  assert.equal(sakurako[0], '앵자')
  const watanabe = koreanNameCandidates('渡辺')
  assert.equal(watanabe.length, 3)
  assert.equal(watanabe[0], '도변')
  for (const name of ['沢子', '斎']) assert.equal(koreanNameCandidates(name).length, 3, name)
})

test('반각 가타카나와 호환 한자도 읽는다 (NFKC)', () => {
  assert.ok(koreanNameCandidates('ﾖｳｺ').includes('요코'))
  assert.equal(koreanNameCandidates('神').length, 3)
})

test('한글 이름은 1~10음절이면 그대로 쓴다 (띄어쓰기는 뺀다)', () => {
  assert.equal(hangulName('김철수'), '김철수')
  assert.equal(hangulName(' 김 철수 '), '김철수')
  assert.equal(hangulName('가나다라마바사아자차'), '가나다라마바사아자차')
})
test('한글이 아니거나 11음절 이상이면 그대로 쓰지 않는다', () => {
  for (const input of ['', 'abc', '123', '陽子', '김abc', '가나다라마바사아자차카']) assert.equal(hangulName(input), null, input)
})

test('설정: 이름 후보가 오면 첫 번째를 미리 고르고, 사용자가 고른 후보가 있으면 그것을 둔다', () => {
  const c = [{ name: '전양자' }, { name: '전요코' }]
  assert.equal(chosenName(c, null), '전양자')
  assert.equal(chosenName(c, '전요코'), '전요코')
  // 입력을 바꿔 후보가 새로 오면 앞에서 고른 이름은 없으니 다시 첫 번째
  assert.equal(chosenName([{ name: '김하나' }], '전요코'), '김하나')
  assert.equal(chosenName([], '전요코'), null)
})
