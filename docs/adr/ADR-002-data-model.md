# ADR-002: 데이터 모델 — `seals`를 `stamp_profiles`로, 이름 풀과 세트 코드는 뺀다

- 상태: 채택
- 날짜: 2026-11-27
- 결정한 사람: 태원 (BE)
- 관련: [ERD](../design/erd.md), [ADR-001](ADR-001-api-follows-frontend.md)

## 배경

backend/CLAUDE.md 초안의 모델은 `users`, `phrases`(+`set_code`), `stamps`(`collected_at`), `attempts`, `seals`(`korean_name`, `name_pool_id`, `animal`, `style`), `name_pool`이었다. 아직 마이그레이션이 하나도 없어서 지금 바꾸는 비용은 없다.

- "seal"과 "stamp"가 둘 다 도장이라 헷갈린다. FE는 받은 도장 기록을 `Stamp`, 사용자가 고른 동물·이름을 `Profile`이라고 부른다.
- 처음 작성 때 FE가 한국식 이름 후보를 직접 만들었다(`frontend/src/core/names.ts`). 이후 BE가 LLM으로 만들기로 바뀌었다(ADR-004). 어느 쪽이든 `stamp_profiles`에는 고른 이름 문자열만 저장한다.
- FE의 한마디 id는 `content/phrases.json`의 문자열(`q1`~`q6`)이다.

## 결정

1. `seals` → **`stamp_profiles`** (`user_id` PK, `animal` NULL, `korean_name` NULL, `updated_at`). "내 도장 모양"이라는 뜻이다. 받은 도장은 계속 `stamps`.
2. `name_pool` 테이블과 `stamp_profiles.name_pool_id`, `style` 컬럼을 뺀다. (이름 후보는 [ADR-004](ADR-004-llm-name-suggestions.md)에 따라 LLM이 만들고 `name_suggestions`에 캐시한다)
3. `stamps.collected_at` → `stamps.stamped_at` (API 필드와 같게).
4. `phrases.id`는 `TEXT`, `phrases.json`의 id를 그대로 쓴다. ~~`set_code`는 뺀다.~~ → [ADR-003](ADR-003-phrase-sets-and-api.md)에 따라 `phrase_sets` 테이블과 `phrases.set_code` FK를 둔다.
5. `attempts`는 보류(ADR-001 H-2). 만들지 않는다.
6. `animal`, `user_role`은 PostgreSQL ENUM.
7. `korean_name`은 DB에도 `CHECK (korean_name = '' OR korean_name ~ '^[가-힣]{1,10}$')`를 둔다. `NULL` = 아직 안 정함, `''` = 이름을 패스함(동물만 있는 도장, FE PR #2), 그 밖 = 고른 이름. 세 상태를 컬럼 하나로 나타낸다(따로 `name_skipped` 플래그를 두면 FE `Profile.koreanName`과 모양이 달라진다).
9. (2026-11-27 추가) `phrases.label`(지도 핀 이름표, 일본어) 컬럼을 둔다. FE PR #2에서 `phrases.json`에 `label`이 추가됐다.
8. `stamp_profiles` 행은 첫 프로필 저장 때 upsert로 만든다. 행이 없으면 둘 다 NULL로 본다.

## 검토한 대안

| 대안 | 버린 이유 |
|---|---|
| seals를 `stamps`로 바꾸고 받은 도장을 `stamp_marks` 등으로 바꾸기 | FE·API에서 이미 받은 도장을 `stamps`로 부른다. 이름이 반대로 엇갈린다 |
| `animal`, `korean_name`을 `users`에 컬럼으로 넣기 | 테이블이 하나 줄어 단순하다. 하지만 계정(스크립트가 발급)과 사용자가 고르는 값(리허설 뒤 `reset.py`로 지움)을 나눠 두면 초기화가 `DELETE FROM stamp_profiles` 한 줄로 끝난다 |
| `name_pool` 유지 (서버가 고정 이름 목록에서 후보 제공) | 고정 목록은 FE `names.ts`의 인기 이름과 같은 한계가 있다. 서버 후보는 LLM 방식으로 정했다(ADR-004) |
| `phrases.id` 정수 + `code` 컬럼 | 키가 두 개가 된다. FE는 문자열 id만 안다 |
| ENUM 대신 `TEXT + CHECK` | 값 추가가 쉬움. 하지만 행사까지 값이 바뀔 일이 없고 ENUM이 OpenAPI·SQLAlchemy에 그대로 드러난다 |

## 결과와 트레이드오프

- 이 ADR만으로는 테이블 4개(`users`, `stamp_profiles`, `phrases`, `stamps`). ADR-003·004로 `phrase_sets`, `name_suggestions`가 더해져 6개.
- 이름 규칙을 서버로 옮기거나 도장 스타일을 고르게 하려면 새 마이그레이션이 필요하다.
- backend/CLAUDE.md의 데이터 모델 절을 이 ADR에 맞게 고친다.
