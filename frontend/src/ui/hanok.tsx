// 한옥 그림: 기와지붕, 청사초롱, 하늘(별·달/해), 밤·낮 토글. 색은 index.css 토큰 (DESIGN.md §5)
import { useSyncExternalStore } from 'react'
import type { ThemeControl } from '../core/theme.ts'
import { JA } from '../i18n.ts'

/** 처마 아래선. 가운데(150)가 가장 낮고(70) 양 끝 추녀가 들린다(40). viewBox 300×112 */
const eave = (x: number) => 70 - 30 * Math.pow(Math.abs(x - 150) / 148, 3)
const XS = Array.from({ length: 75 }, (_, i) => 2 + i * 4)
const at = (x: number, dy = 0) => `${x} ${(eave(x) + dy).toFixed(1)}`
const EAVE_LR = XS.map((x) => at(x)).join(' L')
const EAVE_RL = [...XS].reverse().map((x) => at(x)).join(' L')
const SHADE_RL = [...XS].reverse().map((x) => at(x, 10)).join(' L')
const UNDER = `M${EAVE_LR} L${SHADE_RL} Z`
const TILES = `M2 ${(eave(2) - 6).toFixed(1)} C16 38 38 34 62 26 Q150 22 238 26 C262 34 284 38 298 ${(eave(298) - 6).toFixed(1)} L${EAVE_RL} Z`
/** 기와골: 용마루에서 처마로 퍼지는 줄 */
const GROOVES = Array.from({ length: 27 }, (_, i) => {
  const tx = 64 + i * (172 / 26)
  const bx = 150 + (tx - 150) * 1.66
  return `M${tx.toFixed(1)} 27 Q${((tx + bx) / 2).toFixed(1)} ${(eave(bx) - 18).toFixed(1)} ${bx.toFixed(1)} ${(eave(bx) - 2).toFixed(1)}`
}).join(' ')
const MAKSAE = Array.from({ length: 41 }, (_, i) => 8 + i * 7)
const RAFTERS = Array.from({ length: 28 }, (_, i) => 26 + i * 9)
const RIDGE = 'M56 28 Q150 20 244 28 L250 15 Q246 22 240 20 Q150 13 60 20 Q54 22 50 15 Z'

export function Lantern({ className = '' }: { className?: string }) {
  return (
    <svg className={`lantern ${className}`} viewBox="0 0 40 70" aria-hidden="true">
      <LanternShapes />
    </svg>
  )
}

/** 기와지붕. 화면 폭에 꽉 차게 그린다 */
export function Roof() {
  return (
    <div className="roof" aria-hidden="true">
      <svg viewBox="0 0 300 112">
        <path className="r-under" d={UNDER} />
        {RAFTERS.map((x) => (
          <circle key={x} className="r-rafter" cx={x} cy={(eave(x) + 6).toFixed(1)} r="2.2" />
        ))}
        <path className="r-tiles" d={TILES} />
        <path className="r-groove" d={GROOVES} />
        {MAKSAE.map((x) => (
          <circle key={x} className="r-maksae" cx={x} cy={(eave(x) - 1).toFixed(1)} r="2.6" />
        ))}
        <path className="r-ridge" d={RIDGE} />
        <rect className="r-beam" x="0" y="84" width="300" height="9" />
        <rect className="r-beam" x="22" y="76" width="6" height="20" />
        <rect className="r-beam" x="272" y="76" width="6" height="20" />
        <svg x="32" y="80" width="17" height="30" viewBox="0 0 40 70">
          <LanternShapes />
        </svg>
        <svg x="251" y="80" width="17" height="30" viewBox="0 0 40 70">
          <LanternShapes />
        </svg>
      </svg>
    </div>
  )
}

function LanternShapes() {
  return (
    <>
      <line className="l-string" x1="20" y1="0" x2="20" y2="10" />
      <rect className="l-cap" x="11" y="9" width="18" height="5" rx="1" />
      <path className="l-red" d="M8 18 Q20 10 32 18 L32 33 L8 33 Z" />
      <path className="l-blue" d="M8 33 L32 33 L32 46 Q20 54 8 46 Z" />
      <ellipse className="l-glow" cx="20" cy="31" rx="13" ry="18" />
      <rect className="l-cap" x="11" y="49" width="18" height="4" rx="1" />
      <path className="l-tassel" d="M20 53 V68 M17 56 V66 M23 56 V66" />
    </>
  )
}

/** 화면 뒤 하늘. 밤: 별(+ 초승달) / 낮: 한지 결(+ 해). orb는 한마디판·로그인에서만 */
export function Sky({ orb }: { orb: boolean }) {
  return (
    <div className="sky" aria-hidden="true">
      {orb && (
        <svg className="orb" viewBox="0 0 50 50">
          <defs>
            <mask id="crescent">
              <rect width="50" height="50" fill="#fff" />
              <circle cx="33" cy="19" r="18" fill="#000" />
            </mask>
          </defs>
          <circle className="moon" cx="25" cy="25" r="20" mask="url(#crescent)" />
          <circle className="sun-rim" cx="25" cy="25" r="17" />
          <circle className="sun" cx="25" cy="25" r="12" />
        </svg>
      )}
    </div>
  )
}

export function ThemeToggle({ theme }: { theme: ThemeControl }) {
  const current = useSyncExternalStore(theme.subscribe, theme.get)
  const night = current === 'night'
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={night ? JA.theme.toDay : JA.theme.toNight}
      onClick={() => theme.set(night ? 'day' : 'night')}
    >
      <i aria-hidden="true">{night ? '☾' : '☀'}</i>
      {night ? JA.theme.night : JA.theme.day}
    </button>
  )
}
