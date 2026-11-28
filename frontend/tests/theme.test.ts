// DESIGN.md §2: 처음엔 낮, 고른 테마는 기기에 남는다
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTheme } from '../src/core/theme.ts'
import { memoryStorage } from './helpers.ts'

test('처음 열면 낮이고, 밤으로 바꾸면 다시 열어도 밤이다', () => {
  const storage = memoryStorage()
  const applied: string[] = []
  const theme = createTheme(storage, (t) => applied.push(t))
  assert.equal(theme.get(), 'day')
  let heard = 0
  theme.subscribe(() => heard++)
  theme.set('night')
  assert.equal(heard, 1)
  assert.deepEqual(applied, ['day', 'night'])
  assert.equal(createTheme(storage).get(), 'night')
})

test('저장값이 이상하면 낮', () => {
  const storage = memoryStorage()
  storage.setItem('ichimadi:theme', 'blue')
  assert.equal(createTheme(storage).get(), 'day')
})
