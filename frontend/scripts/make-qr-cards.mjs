// 체험 계정 QR 카드 생성기. 심사위원이 카드를 스캔하면 `#login=<id>.<password>`로 자동 로그인한다.
// 사용법: npm run qr -- --base-url <url> [--accounts-file <path>]
// 결과물(qr-cards/)에는 비밀번호가 들어 있으므로 커밋하지 않는다(.gitignore).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import QRCode from 'qrcode'
import { parseTrialAccounts } from '../src/data/accounts.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'qr-cards')
const CARDS_PER_PAGE = 8

function fail(message) {
  console.error(`오류: ${message}`)
  process.exit(1)
}

function parseBaseUrl(raw) {
  if (!raw) fail('--base-url이 필요합니다. 예: npm run qr -- --base-url https://ichimadi.example.com')
  let url
  try {
    url = new URL(raw)
  } catch {
    fail(`--base-url이 올바른 URL이 아닙니다: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') fail(`--base-url은 http:// 또는 https://로 시작해야 합니다: ${raw}`)
  if (url.hash || url.search) fail(`--base-url에 ?나 #를 넣지 마세요: ${raw}`)
  return raw.replace(/\/+$/, '')
}

async function readAccountsRaw(accountsFile) {
  if (accountsFile) {
    try {
      return await readFile(accountsFile, 'utf8')
    } catch {
      fail(`--accounts-file을 읽을 수 없습니다: ${accountsFile}`)
    }
  }
  let env
  try {
    env = await readFile(join(root, '.env.local'), 'utf8')
  } catch {
    return ''
  }
  const line = env.split(/\r?\n/).find((l) => l.trim().startsWith('VITE_TRIAL_ACCOUNTS='))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2') : ''
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function cardsHtml(cards) {
  const pages = []
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) pages.push(cards.slice(i, i + CARDS_PER_PAGE))
  const pageHtml = pages
    .map(
      (page) => `<section class="page">
${page
  .map(
    (c) => `  <div class="card">
    <img src="${escapeHtml(c.file)}" alt="QR">
    <p class="hint">カメラで読み取るとログインできます</p>
    <dl><dt>ID</dt><dd>${escapeHtml(c.id)}</dd><dt>パスワード</dt><dd>${escapeHtml(c.password)}</dd></dl>
  </div>`,
  )
  .join('\n')}
</section>`,
    )
    .join('\n')
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>イチマディ 体験アカウント</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Hiragino Sans", "Yu Gothic", sans-serif; color: #000; background: #fff; }
  .page { display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr); gap: 4mm; width: 190mm; height: 277mm; break-after: page; }
  .page:last-child { break-after: auto; }
  .card { border: 0.3mm dashed #888; padding: 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .card img { width: 42mm; height: 42mm; image-rendering: pixelated; }
  .hint { margin: 1.5mm 0; font-size: 9pt; }
  dl { margin: 0; display: grid; grid-template-columns: auto auto; gap: 0.5mm 2mm; font-size: 10pt; }
  dt { color: #555; text-align: right; }
  dd { margin: 0; font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: bold; text-align: left; }
</style>
</head>
<body>
${pageHtml}
</body>
</html>
`
}

const { values } = parseArgs({ options: { 'base-url': { type: 'string' }, 'accounts-file': { type: 'string' } } })
const baseUrl = parseBaseUrl(values['base-url'])
const accounts = parseTrialAccounts(await readAccountsRaw(values['accounts-file']))
if (accounts.length === 0) {
  fail(
    values['accounts-file']
      ? `${values['accounts-file']}에서 계정을 찾지 못했습니다. 형식: id:password,id:password`
      : 'frontend/.env.local의 VITE_TRIAL_ACCOUNTS에 계정이 없습니다. 형식: id:password,id:password (또는 --accounts-file <path>)',
  )
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
const cards = []
for (const [i, { id, password }] of accounts.entries()) {
  const payload = `${baseUrl}/#login=${encodeURIComponent(id)}.${encodeURIComponent(password)}`
  const file = `${String(i + 1).padStart(2, '0')}-${id.replace(/[^A-Za-z0-9_-]/g, '_')}.png`
  await QRCode.toFile(join(outDir, file), payload, { errorCorrectionLevel: 'M', margin: 2, width: 512 })
  cards.push({ id, password, file })
}
await writeFile(join(outDir, 'cards.html'), cardsHtml(cards))
console.log(`QR 카드 ${cards.length}장을 만들었습니다: ${join(outDir, 'cards.html')}`)
