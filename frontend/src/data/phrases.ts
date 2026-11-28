// 오프라인 시연 모드(VITE_STORE=local)와 테스트가 쓰는 한마디. 원본은 레포 루트의 content/phrases.json (DB 시드)이고
// 서버 모드는 GET /api/phrases로 받는다. 문장을 바꿀 때는 그 파일만 고친다. kana, ja, when, reply*는 일본어 검수 전 초안이다.
import type { Phrase } from '../core/types.ts'
import data from '../../../content/phrases.json' with { type: 'json' }

// content/phrases.json에는 다른 카테고리(cafe 등)도 들어 있다. 한마디판은 행사장 세트만 쓴다. set이 없으면 hackathon (ADR-003, seed.py와 같은 규칙)
const rows: Array<Phrase & { set?: string }> = data
export const PHRASES: Phrase[] = rows.filter((p) => (p.set ?? 'hackathon') === 'hackathon')
