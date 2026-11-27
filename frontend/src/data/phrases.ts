// 오프라인 시연 모드(VITE_STORE=local)와 테스트가 쓰는 한마디. 원본은 레포 루트의 content/phrases.json (DB 시드)이고
// 서버 모드는 GET /api/phrases로 받는다. 문장을 바꿀 때는 그 파일만 고친다. kana, ja, when, reply*는 일본어 검수 전 초안이다.
import type { Phrase } from '../core/types.ts'
import data from '../../../content/phrases.json' with { type: 'json' }

export const PHRASES: Phrase[] = data
