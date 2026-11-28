// 한옥 그림: 처마(화면 맨 위 기와 띠), 청사초롱, 하늘(별·달/해), 낮·밤 토글. 색은 index.css 토큰 (DESIGN.md §5)
import { useSyncExternalStore } from 'react'
import type { ThemeControl } from '../core/theme.ts'
import { JA } from '../i18n.ts'

/**
 * 처마 아래선. 화면 맨 위에서 올려다본 처마라서 지붕 윗부분은 화면 밖이고 기와 끝만 보인다.
 * 가운데(150)가 가장 낮고(44) 양 끝 추녀가 들린다(18). viewBox 300×80
 */
const eave = (x: number) => 44 - 26 * Math.pow(Math.abs(x - 150) / 150, 3)
const XS = Array.from({ length: 76 }, (_, i) => i * 4)
const at = (x: number, dy = 0) => `${x} ${(eave(x) + dy).toFixed(1)}`
const EAVE_RL = [...XS].reverse().map((x) => at(x)).join(' L')
const EAVE_LR = XS.map((x) => at(x)).join(' L')
const SHADE_RL = [...XS].reverse().map((x) => at(x, 9)).join(' L')
/** 기와면: 화면 위 끝(y=0)부터 처마선까지 */
const TILES = `M0 0 H300 L${EAVE_RL} Z`
/** 처마 그늘(서까래가 보이는 띠) */
const UNDER = `M${EAVE_LR} L${SHADE_RL} Z`
/** 기와골: 위에서 처마 끝으로 조금씩 퍼지는 줄 */
const GROOVES = Array.from({ length: 33 }, (_, i) => {
  const bx = 4 + i * (292 / 32)
  const tx = 150 + (bx - 150) * 0.8
  return `M${tx.toFixed(1)} 0 Q${((tx + bx) / 2).toFixed(1)} ${(eave(bx) * 0.5).toFixed(1)} ${bx.toFixed(1)} ${(eave(bx) - 3).toFixed(1)}`
}).join(' ')
const MAKSAE = Array.from({ length: 43 }, (_, i) => 3 + i * 7)
const RAFTERS = Array.from({ length: 32 }, (_, i) => 10 + i * 9)

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

/** 화면 맨 위 처마 띠. 양 끝 추녀 아래에 청사초롱이 달린다. 모든 화면 공통 */
export function Eaves() {
  return (
    <div className="eaves" aria-hidden="true">
      <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMin slice">
        <path className="r-under" d={UNDER} />
        {RAFTERS.map((x) => (
          <circle key={x} className="r-rafter" cx={x} cy={(eave(x) + 5).toFixed(1)} r="2" />
        ))}
        <path className="r-tiles" d={TILES} />
        <path className="r-groove" d={GROOVES} />
        {MAKSAE.map((x) => (
          <circle key={x} className="r-maksae" cx={x} cy={(eave(x) - 1).toFixed(1)} r="2.6" />
        ))}
        <svg x="30" y={(eave(40) + 6).toFixed(1)} width="20" height="35" viewBox="0 0 40 70">
          <LanternShapes />
        </svg>
        <svg x="250" y={(eave(260) + 6).toFixed(1)} width="20" height="35" viewBox="0 0 40 70">
          <LanternShapes />
        </svg>
      </svg>
    </div>
  )
}

/** 화면 뒤 하늘. 낮: 한지 결(+ 해) / 밤: 별(+ 초승달). orb는 한마디판·로그인에서만 */
export function Sky({ orb }: { orb: boolean }) {
  return (
    <div className="sky" aria-hidden="true">
      {orb && (
        <svg className="orb" viewBox="0 0 50 50">
          <SunMoon />
        </svg>
      )}
    </div>
  )
}

/** 해와 달을 함께 그리고 테마에 맞는 쪽만 CSS로 보인다 */
function SunMoon() {
  return (
    <>
      <defs>
        <mask id="crescent">
          <rect width="50" height="50" fill="#fff" />
          <circle cx="33" cy="19" r="18" fill="#000" />
        </mask>
      </defs>
      <circle className="moon" cx="25" cy="25" r="20" mask="url(#crescent)" />
      <circle className="sun-rim" cx="25" cy="25" r="17" />
      <circle className="sun" cx="25" cy="25" r="12" />
    </>
  )
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
)

/** 오른쪽 위 낮(해) · 밤(달) 선택. 아이콘만 보인다 */
export function ThemeToggle({ theme }: { theme: ThemeControl }) {
  const current = useSyncExternalStore(theme.subscribe, theme.get)
  return (
    <div className="theme-toggle" role="group" aria-label={JA.theme.label}>
      <button type="button" className="theme-opt" aria-pressed={current === 'day'} aria-label={JA.theme.day} onClick={() => theme.set('day')}>
        <SunIcon />
      </button>
      <button type="button" className="theme-opt" aria-pressed={current === 'night'} aria-label={JA.theme.night} onClick={() => theme.set('night')}>
        <MoonIcon />
      </button>
    </div>
  )
}
