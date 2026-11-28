// 도장 = 동물 모양. framed면 붉은 네모 낙관 틀 안에 넣는다. 동물마다 실루엣 하나와 이름이 들어갈 자리. 모두 viewBox 0 0 100 100
import type { ReactNode } from 'react'
import type { Animal } from '../core/types.ts'
import { JA } from '../i18n.ts'

type StampShape = {
  /** 인주(빨강)로 찍히는 부분 */
  ink: ReactNode
  /** 종이 색으로 비우는 무늬 (귀 안, 줄무늬, 눈) */
  paper: ReactNode
  /** 이름 자리: 가운데 x, y와 들어갈 폭, 가장 큰 글자 크기 */
  text: { x: number; y: number; width: number; max: number }
}

export const STAMPS: Record<Animal, StampShape> = {
  tiger: {
    ink: (
      <>
        <circle cx="24" cy="24" r="11" />
        <circle cx="76" cy="24" r="11" />
        <path d="M50 16C74 16 90 32 92 52L99 58 91 64 96 72 87 74C80 88 66 94 50 94S20 88 13 74L4 72 9 64 1 58 8 52C10 32 26 16 50 16Z" />
      </>
    ),
    paper: (
      <>
        <circle cx="24" cy="23" r="4.5" />
        <circle cx="76" cy="23" r="4.5" />
        <path className="seal-cut" d="M50 21v10M41 23l3 8M59 23l-3 8M9 58h9M91 58h-9M13 68l8-2M87 68l-8-2" />
      </>
    ),
    text: { x: 50, y: 62, width: 58, max: 24 },
  },
  rabbit: {
    ink: (
      <>
        <ellipse cx="36" cy="27" rx="10" ry="25" transform="rotate(-12 36 27)" />
        <ellipse cx="64" cy="27" rx="10" ry="25" transform="rotate(12 64 27)" />
        <ellipse cx="50" cy="69" rx="38" ry="29" />
      </>
    ),
    paper: (
      <>
        <ellipse cx="36" cy="25" rx="4" ry="16" transform="rotate(-12 36 25)" />
        <ellipse cx="64" cy="25" rx="4" ry="16" transform="rotate(12 64 25)" />
      </>
    ),
    text: { x: 50, y: 71, width: 58, max: 24 },
  },
  magpie: {
    ink: (
      <>
        <path d="M32 60 2 86l6 7 32-20Z" />
        <ellipse cx="48" cy="60" rx="33" ry="23" transform="rotate(-12 48 60)" />
        <circle cx="76" cy="36" r="15" />
        <path d="M88 30 100 35 88 41Z" />
        <path className="seal-leg" d="M44 80l-3 13M57 79l1 13" />
      </>
    ),
    paper: <circle cx="80" cy="33" r="2.8" />,
    text: { x: 47, y: 61, width: 48, max: 20 },
  },
  bear: {
    ink: (
      <>
        <circle cx="21" cy="27" r="14" />
        <circle cx="79" cy="27" r="14" />
        <circle cx="50" cy="56" r="40" />
      </>
    ),
    paper: (
      <>
        <circle cx="19" cy="25" r="5.5" />
        <circle cx="81" cy="25" r="5.5" />
        <ellipse cx="50" cy="81" rx="14" ry="9" />
        <ellipse className="seal-dot" cx="50" cy="78" rx="5" ry="3.5" />
      </>
    ),
    text: { x: 50, y: 56, width: 62, max: 24 },
  },
}

export const ANIMALS = Object.keys(STAMPS) as Animal[]

/** 이름이 길수록 글자를 줄여 모양 안에 넣는다 (한글 한 글자 폭 = 1em) */
export function nameFontSize(name: string, text: StampShape['text']): number {
  return Math.min(text.max, text.width / Math.max(1, [...name].length))
}

/** 내 도장: 동물 모양 안에 한국식 이름. 이름이 비었으면('' = 패스) 모양만 (+ 받은 시각) */
export function Seal({
  animal,
  name,
  time,
  size = 'small',
  stampIn = false,
  decorative = false,
  framed = false,
}: {
  animal: Animal | null
  name: string | null
  time?: string
  size?: 'small' | 'big'
  stampIn?: boolean
  /** 옆에 글자가 따로 있으면 읽어 주지 않는다 */
  decorative?: boolean
  /** 낙관: 붉은 네모 틀 안에 창호지색 동물 (DESIGN.md §5) */
  framed?: boolean
}) {
  if (!animal) return null
  const shape = STAMPS[animal]
  const label = name ? `${JA.animal[animal]} ${name}` : JA.animal[animal]
  return (
    <span className={`seal seal-${size}${framed ? ' seal-framed' : ''}${stampIn ? ' stamp-in' : ''}`}>
      <svg viewBox="0 0 100 100" {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}>
        <g className="seal-ink">{shape.ink}</g>
        <g className="seal-paper">{shape.paper}</g>
        {name && (
          <text
            className="seal-name"
            lang="ko"
            x={shape.text.x}
            y={shape.text.y}
            fontSize={nameFontSize(name, shape.text)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {name}
          </text>
        )}
      </svg>
      {time && <small className="seal-time">{time}</small>}
    </span>
  )
}
