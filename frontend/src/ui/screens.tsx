import { useEffect, useState, type FormEvent } from 'react'
import type { Animal, Phrase, Profile, Stamp } from '../core/types.ts'
import { koreanNameCandidates } from '../core/names.ts'
import { canSpeak, speakKorean } from '../core/speak.ts'
import { bookProgress, formatStampTime } from '../core/stamps.ts'
import { PHRASES } from '../data/phrases.ts'
import { JA, PARTNER } from '../i18n.ts'
import { ANIMALS, Pouch, Seal } from './parts.tsx'

/** 저장 결과. 실패하면 화면이 다시 누르게 한다. */
type Result = Promise<boolean>

const stampOf = (stamps: Stamp[], phraseId: string) => stamps.find((s) => s.phraseId === phraseId)

export function Login({ onSubmit }: { onSubmit: (id: string, password: string) => Promise<'ok' | 'failed' | 'error'> }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const r = await onSubmit(id.trim(), password)
    setBusy(false)
    if (r === 'failed') setMessage(JA.login.failed)
    if (r === 'error') setMessage(JA.error)
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
        {message && (
          <p className="error" role="alert">
            {message}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? JA.login.busy : JA.login.submit}
        </button>
      </form>
    </main>
  )
}

export function AnimalPick({ onPick }: { onPick: (a: Animal) => Result }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function pick(a: Animal) {
    setBusy(true)
    const ok = await onPick(a)
    setBusy(false)
    setFailed(!ok)
  }
  return (
    <main className="page stack">
      <h2>{JA.animal.title}</h2>
      <p className="muted">{JA.animal.lead}</p>
      <div className="animal-grid">
        {ANIMALS.map((a) => (
          <button key={a.id} className="animal" type="button" disabled={busy} onClick={() => pick(a.id)}>
            <span className="animal-emoji" aria-hidden="true">
              {a.emoji}
            </span>
            <span>{JA.animal[a.id]}</span>
          </button>
        ))}
      </div>
      {failed && (
        <p className="error" role="alert">
          {JA.error}
        </p>
      )}
    </main>
  )
}

export function NamePick({
  animal,
  onConfirm,
  onBack,
}: {
  animal: Animal | null
  onConfirm: (name: string) => Result
  onBack: () => void
}) {
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const candidates = koreanNameCandidates(input)
  const chosen = picked && candidates.includes(picked) ? picked : null

  async function confirm() {
    if (!chosen) return
    setBusy(true)
    const ok = await onConfirm(chosen)
    setBusy(false)
    setFailed(!ok)
  }

  return (
    <main className="page stack">
      <button className="link back" type="button" onClick={onBack}>
        ← {JA.name.back}
      </button>
      <h2>{JA.name.title}</h2>
      <label className="field">
        <span>{JA.name.lead}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={JA.name.placeholder}
          aria-label={JA.name.label}
          maxLength={10}
          autoComplete="off"
          lang="ja"
        />
      </label>
      {input.trim() && candidates.length === 0 && <p className="muted">{JA.name.unreadable}</p>}
      {candidates.length > 0 && (
        <div className="stack-sm">
          <p className="label">{JA.name.candidates}</p>
          <div className="candidates">
            {candidates.map((c) => (
              <button
                key={c}
                type="button"
                lang="ko"
                className={`candidate${c === chosen ? ' is-picked' : ''}`}
                aria-pressed={c === chosen}
                onClick={() => setPicked(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {chosen && (
        <div className="preview">
          <p className="label">{JA.name.preview}</p>
          <Seal animal={animal} name={chosen} size="big" />
        </div>
      )}
      {failed && (
        <p className="error" role="alert">
          {JA.error}
        </p>
      )}
      <button className="btn" type="button" disabled={!chosen || busy} onClick={confirm}>
        {JA.name.confirm}
      </button>
    </main>
  )
}

function Progress({ stamps }: { stamps: Stamp[] }) {
  const p = bookProgress(stamps, PHRASES)
  return (
    <span className="count">
      {JA.board.stamps} {p.count}/{p.total}
    </span>
  )
}

export function Board({
  profile,
  stamps,
  onOpen,
  onBook,
  onLogout,
}: {
  profile: Profile
  stamps: Stamp[]
  onOpen: (p: Phrase) => void
  onBook: () => void
  onLogout: () => void
}) {
  return (
    <main className="page stack">
      <header className="bar">
        <strong className="brand-sm">{JA.appName}</strong>
        <Progress stamps={stamps} />
      </header>
      <div className="me">
        <Seal animal={profile.animal} name={profile.koreanName} />
        <div className="me-links">
          <button className="link" type="button" onClick={onBook}>
            {JA.board.book}
          </button>
          <button className="link" type="button" onClick={() => window.confirm(JA.board.logoutConfirm) && onLogout()}>
            {JA.board.logout}
          </button>
        </div>
      </div>
      <p className="hint">{JA.board.hint}</p>
      <ol className="pouch-grid">
        {PHRASES.map((p, i) => {
          const got = !!stampOf(stamps, p.id)
          return (
            <li key={p.id}>
              <button className={`pouch-btn${got ? ' got' : ''}`} type="button" onClick={() => onOpen(p)}>
                <span className="pouch-num">{i + 1}</span>
                <Pouch />
                {got && (
                  <span className="pouch-mark" role="img" aria-label={JA.board.done}>
                    <Seal animal={profile.animal} name={null} />
                  </span>
                )}
                <span className="pouch-when">{p.when}</span>
              </button>
            </li>
          )
        })}
      </ol>
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

export function Card({ phrase, onSaid, onBack }: { phrase: Phrase; onSaid: () => void; onBack: () => void }) {
  return (
    <main className="page stack">
      <button className="link back" type="button" onClick={onBack}>
        {JA.card.back}
      </button>
      <section className="say">
        <p className="say-ko" lang="ko">
          {phrase.ko}
        </p>
        <p className="kana">{phrase.kana}</p>
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
        <p className="reply-ko" lang="ko">
          {phrase.reply}
        </p>
        <p className="kana">{phrase.replyKana}</p>
        <p className="ja">{phrase.replyJa}</p>
      </section>
      <button className="btn btn-bottom" type="button" onClick={onSaid}>
        {JA.card.said}
      </button>
    </main>
  )
}

export function Partner({ phrase, onOk, onAgain }: { phrase: Phrase; onOk: () => Result; onAgain: () => void }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function ok() {
    setBusy(true)
    const saved = await onOk()
    setBusy(false)
    setFailed(!saved)
  }
  return (
    <main className="partner" lang="ko">
      <p className="partner-show" lang="ja">
        {JA.partner.show}
      </p>
      <div className="partner-body">
        <p className="partner-who">{PARTNER.who}</p>
        <p className="partner-lead">{PARTNER.lead}</p>
        <p className="partner-quote">“{phrase.ko}”</p>
      </div>
      {failed && (
        <p className="partner-error" role="alert">
          {PARTNER.saveFailed}
        </p>
      )}
      <button className="partner-ok" type="button" disabled={busy} onClick={ok}>
        {PARTNER.ok}
      </button>
      <button className="partner-again" type="button" disabled={busy} onClick={onAgain}>
        {PARTNER.again}
      </button>
    </main>
  )
}

export function Stamped({
  phrase,
  profile,
  stamps,
  onBook,
  onBoard,
}: {
  phrase: Phrase
  profile: Profile
  stamps: Stamp[]
  onBook: () => void
  onBoard: () => void
}) {
  const stamp = stampOf(stamps, phrase.id)
  return (
    <main className="page center stack">
      <Seal animal={profile.animal} name={profile.koreanName} time={stamp && formatStampTime(stamp.at)} size="big" stampIn />
      <h2 className="done-title">{JA.stamped.title}</h2>
      <p className="ja">{phrase.ja}</p>
      <Progress stamps={stamps} />
      <button className="btn wide" type="button" onClick={onBook}>
        {JA.stamped.toBook}
      </button>
      <button className="link" type="button" onClick={onBoard}>
        {JA.stamped.toBoard}
      </button>
    </main>
  )
}

export function Book({
  profile,
  stamps,
  closed,
  onClose,
  onReopen,
  onBack,
}: {
  profile: Profile
  stamps: Stamp[]
  closed: boolean
  onClose: () => void
  onReopen: () => void
  onBack: () => void
}) {
  const p = bookProgress(stamps, PHRASES)

  if (closed) {
    return (
      <main className="page center stack">
        <div className="book-cover" role="img" aria-label={`${JA.book.title} ${JA.book.closed}`}>
          <span className="book-cover-title">{JA.book.title}</span>
          <Seal animal={profile.animal} name={profile.koreanName} size="big" />
          <span className="book-cover-done">
            {JA.book.closed} {p.count}/{p.total}
          </span>
        </div>
        <button className="btn wide" type="button" onClick={onReopen}>
          {JA.book.reopen}
        </button>
        <button className="link" type="button" onClick={onBack}>
          {JA.book.back}
        </button>
      </main>
    )
  }

  return (
    <main className="page stack">
      <button className="link back" type="button" onClick={onBack}>
        {JA.book.back}
      </button>
      <header className="bar">
        <h2>{JA.book.title}</h2>
        <Progress stamps={stamps} />
      </header>
      <p className="muted">{JA.book.lead}</p>
      {p.complete && (
        <div className="complete">
          {JA.book.complete}
          <small>{JA.book.completeLead(p.total)}</small>
        </div>
      )}
      <ol className="book-grid">
        {PHRASES.map((ph) => {
          const s = stampOf(stamps, ph.id)
          return (
            <li key={ph.id} className={`slot${s ? ' got' : ''}`}>
              {s ? <Seal animal={profile.animal} name={profile.koreanName} /> : <span className="slot-empty">{JA.book.empty}</span>}
              <span className="slot-ja">{ph.ja}</span>
              {s && <span className="slot-time">{formatStampTime(s.at)}</span>}
            </li>
          )
        })}
      </ol>
      {p.complete && (
        <button className="btn" type="button" onClick={onClose}>
          {JA.book.close}
        </button>
      )}
    </main>
  )
}
