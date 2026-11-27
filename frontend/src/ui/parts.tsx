import type { CSSProperties } from 'react'
import type { Animal } from '../core/types.ts'

export const ANIMALS: { id: Animal; emoji: string }[] = [
  { id: 'tiger', emoji: '🐯' },
  { id: 'rabbit', emoji: '🐰' },
  { id: 'magpie', emoji: '🐦' },
  { id: 'bear', emoji: '🐻' },
]

export function emojiOf(animal: Animal | null): string {
  return ANIMALS.find((a) => a.id === animal)?.emoji ?? ''
}

/** 복주머니. 뚜껑(p-lid)은 열기 화면에서 CSS로 들어 올린다. */
export function Pouch({ className = '' }: { className?: string }) {
  return (
    <svg className={`pouch ${className}`} viewBox="0 0 120 140" aria-hidden="true">
      <path className="p-body" d="M22 62 Q8 124 60 134 Q112 124 98 62 Q92 50 60 50 Q28 50 22 62 Z" />
      <circle className="p-line" cx="60" cy="96" r="22" />
      <text className="p-text" x="60" y="107" textAnchor="middle">
        복
      </text>
      <g className="p-lid">
        <path className="p-top" d="M36 52 Q26 30 42 18 Q50 32 60 18 Q70 32 78 18 Q94 30 84 52 Z" />
        <rect className="p-gold" x="34" y="46" width="52" height="9" rx="4.5" />
        <path className="p-line" d="M60 55 q-10 14 -16 24 M60 55 q10 14 16 24" />
      </g>
    </svg>
  )
}

/** 내 도장: 동물 + 한국식 이름 (+ 받은 시각) */
export function Seal({
  animal,
  name,
  time,
  size = 'small',
  stampIn = false,
}: {
  animal: Animal | null
  name: string | null
  time?: string
  size?: 'small' | 'big'
  stampIn?: boolean
}) {
  return (
    <div className={`seal seal-${size}${stampIn ? ' stamp-in' : ''}`}>
      <span className="seal-animal" aria-hidden="true">
        {emojiOf(animal)}
      </span>
      {name && (
        <b lang="ko" className="seal-name" style={{ '--chars': [...name].length } as CSSProperties}>
          {name}
        </b>
      )}
      {time && <small className="seal-time">{time}</small>}
    </div>
  )
}
