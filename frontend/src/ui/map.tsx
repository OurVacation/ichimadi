// 한마디판의 그림 지도 (진짜 지도·GPS 아님). 길·공원·강·건물을 단순하게 그린다. viewBox 300×400 = 지도 칸 3:4
import { POUCH_SPOTS } from '../data/boardMap.ts'
import { PHRASES } from '../data/phrases.ts'

const W = 300
const H = 400
const ROADS = 'M0 128H300M150 0V400M0 354C100 336 200 374 300 344'
const BUILDINGS = [
  [116, 18, 24, 36],
  [8, 146, 34, 28],
  [160, 140, 34, 26],
  [252, 142, 40, 30],
  [118, 186, 22, 30],
  [8, 298, 28, 24],
  [124, 306, 20, 28],
  [160, 300, 16, 24],
  [258, 360, 34, 32],
]
const TREES = [
  [196, 36],
  [262, 40],
  [270, 88],
  [190, 94],
]
/** 한마디 순서대로 복주머니를 잇는 점선 길 */
const ROUTE = PHRASES.map((p, i) => {
  const s = POUCH_SPOTS[p.id]
  return `${i === 0 ? 'M' : 'L'}${(s.x / 100) * W} ${(s.y / 100) * H}`
}).join('')

export function MapArt() {
  return (
    <svg className="map-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <rect className="m-ground" width={W} height={H} />
      <rect className="m-park" x="176" y="18" width="110" height="94" rx="16" />
      {TREES.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} className="m-tree" cx={cx} cy={cy} r="9" />
      ))}
      <path className="m-water" d="M0 234C80 220 140 262 300 248V292C140 304 80 268 0 282Z" />
      {BUILDINGS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} className="m-building" x={x} y={y} width={w} height={h} rx="3" />
      ))}
      <path className="m-road-edge" d={ROADS} />
      <path className="m-road" d={ROADS} />
      <path className="m-route" d={ROUTE} />
    </svg>
  )
}
