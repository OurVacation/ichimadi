// 사용법 안내(코치마크). 화면을 어둡게 덮고, 실제 버튼만 밝게 남긴 채 옆에 짧은 설명을 단다
import { useLayoutEffect, useState } from 'react'
import { JA } from '../i18n.ts'

/** sel: 밝게 남길 요소. text: [앞, 강조, 뒤]. below: 설명을 요소 아래에 (기본은 위). end: 오른쪽 정렬 */
export type Mark = { sel: string; text: readonly [string, string, string]; below?: boolean; end?: boolean }

type Box = { x: number; y: number; w: number; h: number }
const PAD = 6

export function Coach({ marks, onClose }: { marks: readonly Mark[]; onClose: () => void }) {
  const [boxes, setBoxes] = useState<(Box | null)[]>([])
  const [vh, setVh] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      setVh(window.innerHeight)
      setBoxes(
        marks.map((m) => {
          const r = document.querySelector(m.sel)?.getBoundingClientRect()
          return r ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null
        }),
      )
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [marks])

  return (
    <div className="coach" role="dialog" aria-modal="true" aria-label={JA.guide.title} onClick={onClose}>
      <svg className="coach-dim" aria-hidden="true">
        <defs>
          <mask id="coach-holes">
            <rect width="100%" height="100%" fill="#fff" />
            {boxes.map((b, i) => b && <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="16" fill="#000" />)}
          </mask>
        </defs>
        <rect width="100%" height="100%" mask="url(#coach-holes)" />
      </svg>
      {boxes.map((b, i) => {
        if (!b) return null
        const m = marks[i]
        const style = m.below ? { top: b.y + b.h + 8 } : { bottom: vh - b.y + 8 }
        return (
          <p key={i} className={`coach-note${m.below ? ' is-below' : ''}${m.end ? ' is-end' : ''}`} style={style}>
            <span className="coach-arrow" aria-hidden="true">
              {m.below ? '↑' : '↓'}
            </span>
            <span>
              {m.text[0]}
              <b>{m.text[1]}</b>
              {m.text[2]}
            </span>
          </p>
        )
      })}
      <button className="coach-close" type="button" onClick={onClose}>
        {JA.guide.close}
      </button>
    </div>
  )
}

/** 한마디판: 처음 도장을 정한 직후 */
export const BOARD_MARKS: readonly Mark[] = [
  { sel: '.theme-toggle', text: JA.guide.theme, below: true, end: true },
  { sel: '.wall li:first-child .win', text: JA.guide.window, below: true },
  { sel: '.tabs .tab:last-child', text: JA.guide.book },
]

/** 한마디 카드: 처음 연 카드 */
export const CARD_MARKS: readonly Mark[] = [
  { sel: '.say', text: JA.guide.say, below: true },
  { sel: '.btn-bottom', text: JA.guide.said },
]
