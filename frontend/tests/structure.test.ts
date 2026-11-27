// W-02 (H-11, P-05): 화면 코드는 저장에 직접 닿지 않는다. 저장은 Store로만
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ui = fileURLToPath(new URL('../src/ui', import.meta.url))
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

test('src/ui에 화면 파일이 있다', () => {
  assert.ok(files(ui).some((f) => f.endsWith('.tsx')))
})

test('src/ui 어디에도 localStorage가 없다', () => {
  for (const f of files(ui)) assert.ok(!readFileSync(f, 'utf8').includes('localStorage'), f)
})
