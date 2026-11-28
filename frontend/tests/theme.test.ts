// DESIGN.md §2: 처음엔 밤, 고른 테마는 기기에 남는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTheme } from '../src/core/theme.ts'
import { memoryStorage } from './helpers.ts'

test('처음 열면 밤이고, 낮으로 바꾸면 다시 열어도 낮이다', () => {
  const storage = memoryStorage()
  const applied: string[] = []
  const theme = createTheme(storage, (t) => applied.push(t))
  assert.equal(theme.get(), 'night')
  let heard = 0
  theme.subscribe(() => heard++)
  theme.set('day')
  assert.equal(heard, 1)
  assert.deepEqual(applied, ['night', 'day'])
  assert.equal(createTheme(storage).get(), 'day')
})

test('저장값이 이상하면 밤', () => {
  const storage = memoryStorage()
  storage.setItem('ichimadi:theme', 'blue')
  assert.equal(createTheme(storage).get(), 'night')
})
