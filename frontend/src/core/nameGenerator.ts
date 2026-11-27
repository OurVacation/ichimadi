// 이름 짓기의 기본 구현: 임시 규칙(names.ts)을 NameGenerator 모양으로 감싼다.
// 팀원의 AI(성씨에서 한 글자 + 이름을 한국 이름처럼)는 같은 모양으로 만들어 main.tsx에서 바꿔 끼운다.
import type { NameGenerator } from './types.ts'
import { koreanNameCandidates } from './names.ts'
import { JA } from '../i18n.ts'

export const temporaryNameGenerator: NameGenerator = async (fullName) =>
  koreanNameCandidates(fullName).map((name, i) => ({ name, note: i === 0 ? JA.name.noteReading : JA.name.notePopular }))
