import { useEffect, useState, type FormEvent } from 'react'
import type { Animal, NameCandidate, NameGenerator, Phrase, Profile, Stamp } from '../core/types.ts'
import { errorMessage } from '../api/client.ts'
import { hangulToKatakana } from '../core/hangulKana.ts'
import { chosenName, hangulName } from '../core/names.ts'
import { pairWords } from '../core/pairs.ts'
import { canSpeak, speakKorean } from '../core/speak.ts'
import { bookProgress, formatStampTime } from '../core/stamps.ts'
import { JA, PARTNER } from '../i18n.ts'
import { Pouch } from './parts.tsx'
import { ANIMALS, Seal } from './stamps.tsx'

/** 저장 결과. 실패하면 보여 줄 문구, 성공하면 null. 실패하면 화면이 다시 누르게 한다. */
type Result = Promise<string | null>

const stampOf = (stamps: Stamp[], phraseId: string) => stamps.find((s) => s.phraseId === phraseId)

/** 첫 화면. 브랜드와 큰 낙관 하나, 「はじめる」만 (QR 로그인은 뒤에서 이미 진행 중) */
export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="page landing">
      <h1 className="brand">{JA.appName}</h1>
      <div className="landing-seal" aria-hidden="true">
        <span className="stamped-glow" />
        <Seal animal="tiger" name={null} size="big" framed decorative />
      </div>
      <button className="btn btn-bottom" type="button" onClick={onStart}>
        {JA.landing.start}
      </button>
    </main>
  )
}

/** notice: 로그인 화면 아래 알림 (QR 실패, 로그인 끊김). 직접 로그인하면 그 결과로 바뀐다 */
export function Login({ onSubmit, notice = null }: { onSubmit: (id: string, password: string) => Result; notice?: string | null }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [own, setOwn] = useState<string | null | undefined>(undefined)
  const shown = own === undefined ? notice : own

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setOwn(null)
    const message = await onSubmit(id.trim(), password)
    setBusy(false)
    setOwn(message)
  }

  return (
    <main className="page">
      <header className="hero">
        <h1 className="brand">{JA.appName}</h1>
        <p className="tagline">{JA.tagline}</p>
      </header>
      <form className="panel stack" onSubmit={submit}>
        <h2>{JA.login.title}</h2>
        <p className="muted">{JA.login.lead}</p>
        <label className="field">
          <span>{JA.login.id}</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="field">
          <span>{JA.login.password}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="numeric"
            required
          />
        </label>
        {shown && (
          <p className="error" role="alert">
            {shown}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? JA.login.busy : JA.login.submit}
        </button>
      </form>
    </main>
  )
}

/** 입력을 멈추고 이만큼 지나면 이름을 요청한다 */
const NAME_DEBOUNCE_MS = 500

type Names =
  | { kind: 'empty' }
  | { kind: 'waiting' }
  | { kind: 'ready'; candidates: NameCandidate[] }
  | { kind: 'failed'; message: string }

/** 처음 설정: 위에 이름, 아래에 동물. 이름을 기다리는 동안 동물을 고를 수 있다. 결정은 둘 다 정한 뒤 한 번 */
export function Setup({
  generateNames,
  onConfirm,
}: {
  generateNames: NameGenerator
  onConfirm: (profile: { animal: Animal; koreanName: string }) => Result
}) {
  const [input, setInput] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [names, setNames] = useState<Names>({ kind: 'empty' })
  const [picked, setPicked] = useState<string | null>(null)
  const [animal, setAnimal] = useState<Animal | null>(null)
  /** 이름을 패스하면 동물만 있는 도장. 빈 이름('')으로 저장한다 */
  const [passName, setPassName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const fullName = input.trim()
    if (!fullName) {
      setNames({ kind: 'empty' })
      return
    }
    const asIs = hangulName(fullName)
    if (asIs) {
      setNames({ kind: 'ready', candidates: [{ name: asIs, note: JA.name.noteAsIs }] })
      return
    }
    // 입력이 바뀌면 앞 요청의 답은 버린다
    let live = true
    setNames({ kind: 'waiting' })
    const timer = setTimeout(() => {
      generateNames(fullName).then(
        (candidates) => live && setNames({ kind: 'ready', candidates }),
        (e: unknown) => live && setNames({ kind: 'failed', message: errorMessage(e, JA.name.failed) }),
      )
    }, NAME_DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [input, attempt, generateNames])

  const candidates = names.kind === 'ready' ? names.candidates : []
  const chosen = chosenName(candidates, picked)
  const koreanName = passName ? '' : chosen
  /** 결정 버튼이 왜 꺼져 있는지. 남은 단계만 */
  const missing = [koreanName === null && JA.setup.needName, !animal && JA.setup.needAnimal].filter((m) => m !== false)

  async function confirm() {
    if (!animal || koreanName === null) return
    setBusy(true)
    const message = await onConfirm({ animal, koreanName })
    setBusy(false)
    setFailed(message)
  }

  return (
    <main className="page stack">
      <h2>{JA.setup.title}</h2>
      <p className="muted">{JA.setup.lead}</p>
      <section className="stack-sm">
        <label className="field">
          <span>{JA.name.lead}</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={JA.name.placeholder}
            aria-label={JA.name.label}
            maxLength={20}
            autoComplete="off"
            lang="ja"
            disabled={passName}
          />
        </label>
        <button
          className={`pass${passName ? ' is-picked' : ''}`}
          type="button"
          aria-pressed={passName}
          onClick={() => setPassName((on) => !on)}
        >
          {JA.name.pass}
        </button>
        {passName && <p className="muted">{JA.name.passOn}</p>}
        <fieldset className="names" aria-live="polite" disabled={passName}>
          {names.kind === 'waiting' && <p className="muted waiting">{JA.name.waiting}</p>}
          {names.kind === 'failed' && (
            <p className="error">
              {names.message}{' '}
              <button className="link" type="button" onClick={() => setAttempt((n) => n + 1)}>
                {JA.name.retry}
              </button>
            </p>
          )}
          {names.kind === 'ready' && candidates.length === 0 && <p className="error">{JA.name.unreadable}</p>}
          {candidates.length > 0 && (
            <>
              <p className="label">{JA.name.candidates}</p>
              <div className="candidates">
                {candidates.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={`candidate${c.name === chosen ? ' is-picked' : ''}`}
                    aria-pressed={c.name === chosen}
                    onClick={() => setPicked(c.name)}
                  >
                    <b lang="ko">{c.name}</b>
                    <span className="candidate-kana">{hangulToKatakana(c.name)}</span>
                    {c.note && <small>{c.note}</small>}
                  </button>
                ))}
              </div>
            </>
          )}
        </fieldset>
      </section>
      <section className="stack-sm">
        <p className="label">{JA.animal.title}</p>
        <div className="animal-grid">
          {ANIMALS.map((a) => (
            <button
              key={a}
              className={`animal${a === animal ? ' is-picked' : ''}`}
              type="button"
              aria-pressed={a === animal}
              onClick={() => setAnimal(a)}
            >
              <Seal animal={a} name={null} decorative />
              <span>{JA.animal[a]}</span>
            </button>
          ))}
        </div>
      </section>
      {animal && (
        <div className="preview">
          <p className="label">{JA.setup.preview}</p>
          <Seal animal={animal} name={koreanName} size="big" framed />
        </div>
      )}
      {failed && (
        <p className="error" role="alert">
          {failed}
        </p>
      )}
      <div className="btn-bottom stack-sm">
        {missing.length > 0 && (
          <p className="setup-missing" aria-live="polite">
            {missing.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </p>
        )}
        <button className="btn" type="button" disabled={missing.length > 0 || busy} onClick={confirm}>
          {JA.setup.confirm}
        </button>
      </div>
    </main>
  )
}

/** 창 칸 번호: 一 二 三 … (10개 넘으면 숫자) */
const KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const windowNo = (i: number) => KANJI[i] ?? String(i + 1)

/** 한마디판: 한옥 지붕 아래 창 칸. 통한 한마디의 창에 불이 켜진다 (DESIGN.md §6) */
export function Board({
  profile,
  stamps,
  phrases,
  pending,
  notice,
  onOpen,
  onBook,
}: {
  profile: Profile
  stamps: Stamp[]
  phrases: Phrase[]
  /** 아직 서버에 못 보낸 도장 수 */
  pending: number
  /** 서버가 받지 않은 도장의 안내 */
  notice: string | null
  onOpen: (p: Phrase) => void
  onBook: () => void
}) {
  const p = bookProgress(stamps, phrases)
  return (
    <main className="page board">
      <h1 className="brand">{JA.appName}</h1>
      <p className="lit-count">{JA.board.lit(p.count, p.total)}</p>
      {p.count === 0 && <p className="muted hint">{JA.board.hint}</p>}
      {pending > 0 && (
        <p className="pending" role="status">
          {JA.board.pending(pending)}
        </p>
      )}
      {notice && (
        <p className="error" role="alert">
          {notice}
        </p>
      )}
      <ol className="wall">
        {phrases.map((ph, i) => {
          const got = !!stampOf(stamps, ph.id)
          return (
            <li key={ph.id}>
              <button className={`win${got ? ' lit' : ''}`} type="button" onClick={() => onOpen(ph)}>
                {got ? (
                  <span role="img" aria-label={JA.board.done}>
                    <Seal animal={profile.animal} name={profile.koreanName} framed decorative />
                  </span>
                ) : (
                  <Pouch />
                )}
                <span className="win-label">
                  {windowNo(i)}　{ph.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <nav className="tabs">
        <span className="tab is-on" aria-current="page">
          {JA.board.tab}
        </span>
        <button className="tab" type="button" onClick={onBook}>
          {JA.board.book}
        </button>
      </nav>
    </main>
  )
}

/** 흔들림 0.45초 + 뚜껑 0.35초 뒤 카드로. 모션 줄이기면 이 화면을 거치지 않는다. */
const OPEN_MS = 850

export function Opening({ onOpened }: { onOpened: () => void }) {
  useEffect(() => {
    const t = setTimeout(onOpened, OPEN_MS)
    return () => clearTimeout(t)
  }, [onOpened])
  return (
    <main className="page center">
      <Pouch className="pouch-big opening" />
      <p className="muted" aria-live="polite">
        {JA.opening.label}
      </p>
    </main>
  )
}

/** 저장된 로그인을 되살리거나 QR로 로그인하는 동안. 로그인 폼 대신 보인다 */
export function Loading() {
  return (
    <main className="page center">
      <h1 className="brand">{JA.appName}</h1>
      <p className="muted" aria-live="polite">
        {JA.load.busy}
      </p>
    </main>
  )
}

/** 로그인 뒤 한마디나 내 정보를 못 받았을 때. 다시 시도하거나 로그아웃한다 */
export function LoadFailed({ message, onRetry, onLogout }: { message: string; onRetry: () => Promise<void>; onLogout: () => void }) {
  const [busy, setBusy] = useState(false)
  async function retry() {
    setBusy(true)
    await onRetry()
    setBusy(false)
  }
  return (
    <main className="page center stack">
      <h2>{JA.load.title}</h2>
      <p className="muted" role="alert">
        {message}
      </p>
      <button className="btn wide" type="button" disabled={busy} onClick={retry}>
        {busy ? JA.load.busy : JA.load.retry}
      </button>
      <button className="link" type="button" disabled={busy} onClick={onLogout}>
        {JA.board.logout}
      </button>
    </main>
  )
}

/** 한국어 어절마다 아래에 가타카나. 짝이 안 맞으면 가타카나를 한 줄로, 어절 사이를 넓게 */
function Spoken({ ko, kana, className }: { ko: string; kana: string; className: string }) {
  const pairs = pairWords(ko, kana)
  if (!pairs) {
    return (
      <>
        <p className={className} lang="ko">
          {ko}
        </p>
        <p className="kana kana-spaced">{kana}</p>
      </>
    )
  }
  return (
    <p className={`pairs ${className}`} lang="ko">
      {pairs.map((p, i) => (
        <span className="pair" key={i}>
          <span>{p.ko}</span>
          <span className="kana" lang="ja">
            {p.kana}
          </span>
        </span>
      ))}
    </p>
  )
}

/** stamp: 이미 받은 한마디면 그 도장. 카드 맨 위에 받은 시각을 보인다 */
export function Card({ phrase, stamp, onSaid, onBack }: { phrase: Phrase; stamp?: Stamp; onSaid: () => void; onBack: () => void }) {
  return (
    <main className="page stack">
      <button className="link back" type="button" onClick={onBack}>
        {JA.card.back}
      </button>
      {stamp && <p className="card-done">{JA.card.done(formatStampTime(stamp.at))}</p>}
      <section className="say">
        <Spoken ko={phrase.ko} kana={phrase.kana} className="say-ko" />
        <p className="ja">{phrase.ja}</p>
        {canSpeak() && (
          <button className="speak" type="button" onClick={() => speakKorean(phrase.ko)}>
            {JA.card.listen}
          </button>
        )}
      </section>
      <section className="info">
        <p className="label">{JA.card.when}</p>
        <p>{phrase.when}</p>
      </section>
      <section className="info">
        <p className="label">{JA.card.reply}</p>
        <Spoken ko={phrase.reply} kana={phrase.replyKana} className="reply-ko" />
        <p className="ja">{phrase.replyJa}</p>
      </section>
      <button className="btn btn-bottom" type="button" onClick={onSaid}>
        {JA.card.said}
      </button>
    </main>
  )
}

/** 「알아들었어요」는 서버를 기다리지 않는다. 저장은 뒤에서 하고 못 하면 한마디판에 띠로 알린다 */
export function Partner({ phrase, onOk, onAgain }: { phrase: Phrase; onOk: () => void; onAgain: () => void }) {
  return (
    <main className="partner" lang="ko">
      <p className="partner-show" lang="ja">
        {JA.partner.show}
      </p>
      <div className="partner-body">
        <p className="partner-lead">{PARTNER.lead}</p>
        <p className="partner-quote">“{phrase.ko}”</p>
      </div>
      <button className="partner-ok" type="button" onClick={onOk}>
        {PARTNER.ok}
      </button>
      <button className="partner-again" type="button" onClick={onAgain}>
        {PARTNER.again}
      </button>
    </main>
  )
}

export function Stamped({
  phrase,
  profile,
  stamps,
  phrases,
  onBook,
  onBoard,
}: {
  phrase: Phrase
  profile: Profile
  stamps: Stamp[]
  phrases: Phrase[]
  onBook: () => void
  onBoard: () => void
}) {
  const stamp = stampOf(stamps, phrase.id)
  const p = bookProgress(stamps, phrases)
  return (
    <main className="page center stack stamped">
      <div className="stamped-glow" aria-hidden="true" />
      <Seal animal={profile.animal} name={profile.koreanName} size="big" framed stampIn />
      <h2 className="done-title">{JA.stamped.title}</h2>
      <p className="stamped-phrase">
        <span className="stamped-ko" lang="ko">
          {phrase.ko}
        </span>
        <span>
          {phrase.ja}
          {stamp && ` ・ ${formatStampTime(stamp.at)}`}
        </span>
      </p>
      <p className="lit-note">{JA.stamped.lit(p.count)}</p>
      <div className="stamped-actions">
        <button className="btn" type="button" onClick={onBook}>
          {JA.stamped.toBook}
        </button>
        <button className="btn btn-outline" type="button" onClick={onBoard}>
          {JA.stamped.toBoard}
        </button>
      </div>
    </main>
  )
}

/** 표지를 누르면 책이 열리는 시간. 모션 줄이기면 바로 연다 */
const BOOK_OPEN_MS = 450
/** 손가락으로 이만큼 넘기면 다음·이전 장 */
const SWIPE_PX = 50

/**
 * 도장첩: 처음엔 덮인 옛 책(표지). 누르면 열리고 한 장에 한마디(도장) 하나씩 넘겨 본다 (DESIGN.md §6)
 * 받지 않은 한마디도 장은 있고 「まだ」로 비워 둔다. 마지막 장 뒤에는 표지로 돌아간다
 */
export function Book({
  profile,
  stamps,
  phrases,
  onBack,
  onLogout,
}: {
  profile: Profile
  stamps: Stamp[]
  phrases: Phrase[]
  onBack: () => void
  onLogout: () => void
}) {
  const p = bookProgress(stamps, phrases)
  /** null = 표지 */
  const [page, setPage] = useState<number | null>(null)
  const [opening, setOpening] = useState(false)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [touchX, setTouchX] = useState<number | null>(null)

  function open() {
    if (opening) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduce) return setPage(0)
    setOpening(true)
    setTimeout(() => {
      setOpening(false)
      setDir('next')
      setPage(0)
    }, BOOK_OPEN_MS)
  }

  function turn(step: 1 | -1) {
    if (page === null) return
    const next = page + step
    if (next < 0 || next >= phrases.length) return
    setDir(step > 0 ? 'next' : 'prev')
    setPage(next)
  }

  // 한마디판의 도장첩 링크 옆에 있으면 잘못 누르기 쉬워서 표지 맨 아래에 둔다 (폰을 다음 사람에게 넘길 때)
  const logout = (
    <button className="link logout" type="button" onClick={() => window.confirm(JA.board.logoutConfirm) && onLogout()}>
      {JA.board.logout}
    </button>
  )

  if (page === null) {
    return (
      <main className="page stack book">
        <button className="link back" type="button" onClick={onBack}>
          {JA.book.back}
        </button>
        <div className="book-stage">
          <button className={`tome${opening ? ' is-opening' : ''}`} type="button" onClick={open} aria-label={JA.book.openLabel}>
            <span className="tome-binding" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="tome-label">
              <span className="tome-title">{JA.book.cover}</span>
              <Seal animal={profile.animal} name={profile.koreanName} framed decorative />
            </span>
            {p.complete && <span className="tome-done">{JA.book.closed}</span>}
          </button>
        </div>
        <p className="lit-count">{JA.board.lit(p.count, p.total)}</p>
        <p className="muted book-hint">{JA.book.open}</p>
        {logout}
      </main>
    )
  }

  const ph = phrases[page]
  const s = stampOf(stamps, ph.id)
  const last = page === phrases.length - 1
  return (
    <main
      className="page stack book"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return
        const dx = e.changedTouches[0].clientX - touchX
        setTouchX(null)
        if (Math.abs(dx) > SWIPE_PX) turn(dx < 0 ? 1 : -1)
      }}
    >
      <button className="link back" type="button" onClick={() => setPage(null)}>
        {JA.book.toCover}
      </button>
      <article className={`leaf leaf-${dir}`} key={ph.id}>
        <p className="leaf-no">{windowNo(page)}</p>
        {s ? (
          <Seal animal={profile.animal} name={profile.koreanName} size="big" framed />
        ) : (
          <span className="leaf-empty">{JA.book.empty}</span>
        )}
        <p className="leaf-ko" lang="ko">
          {ph.ko}
        </p>
        <p className="leaf-ja">{ph.ja}</p>
        {s && <p className="leaf-time">{formatStampTime(s.at)}</p>}
      </article>
      {last && p.complete && (
        <div className="complete">
          {JA.book.complete}
          <small>{JA.book.completeLead(p.total)}</small>
        </div>
      )}
      <nav className="leaf-nav">
        <button className="btn btn-outline" type="button" disabled={page === 0} onClick={() => turn(-1)}>
          {JA.book.prev}
        </button>
        <span className="leaf-count">{JA.book.page(page + 1, phrases.length)}</span>
        {last ? (
          <button className="btn" type="button" onClick={() => setPage(null)}>
            {JA.book.backToCover}
          </button>
        ) : (
          <button className="btn" type="button" onClick={() => turn(1)}>
            {JA.book.next}
          </button>
        )}
      </nav>
    </main>
  )
}
