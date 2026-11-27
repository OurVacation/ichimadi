// 행사장 한마디. 원본은 레포 루트의 content/phrases.json 하나다 (FE 번들과 DB 시드가 같이 씀).
// 문장을 바꿀 때는 그 파일만 고친다. kana, ja, when, reply*는 일본어 검수 전 초안이다.
import type { Phrase } from '../core/types.ts'
import data from '../../../content/phrases.json' with { type: 'json' }

export const PHRASES: Phrase[] = data
