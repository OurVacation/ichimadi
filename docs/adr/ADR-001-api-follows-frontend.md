# ADR-001: API 모양을 프론트의 `Store` 인터페이스에 맞춘다

- 상태: 채택 (보류 항목 H-1, H-2 있음)
- 날짜: 2026-11-27
- 결정한 사람: 태원 (BE)
- 관련: [API 명세](../design/api.md), [구성 계획](../design/backend-architecture.md), FE 요청서 "프론트가 필요한 API (제안)"

## 배경

FE MVP 화면(M1~M7, 이름 도장)은 이미 브라우저 저장소로 돌아가고 있다. 화면은 `Store` 인터페이스(`login`, `getProfile`, `saveProfile`, `getStamps`, `addStamp`)로만 저장에 닿는다. FE가 이 인터페이스에 맞는 API 목록을 요청서로 보냈다.

backend/CLAUDE.md 초안은 `POST /api/phrases/{id}/attempts`(understood | retry를 기록하고 understood면 도장)와 `names`·`phrases`·`stats` 라우터를 계획했다.

코드 프리즈(2026-11-29 17:00)까지 이틀 남았다.

## 결정

1. 엔드포인트는 FE 요청서를 따른다: `POST /api/auth/login`, `GET /api/me`, `PUT /api/me/profile`, `GET /api/me/stamps`, `POST /api/me/stamps`.
2. 도장 GET·POST는 같은 응답 `{stamps, progress}`를 준다. 전체 목록과 진행도(`count`, `total`, `completed`)를 모두 넣고 FE가 골라 쓴다. (진행도는 ADR-003에 따라 카테고리별 배열)
3. `POST /api/me/stamps`는 멱등이다. 이미 있으면 첫 시각을 지키고 200으로 같은 응답을 준다.
4. 사용자는 토큰으로만 식별한다(`/me` 아래). 경로에 `user_id`를 받지 않는다.
5. 로그인 아이디·비밀번호 정규화(NFKC, trim, 아이디 소문자)를 서버에서도 한다.
6. JWT 만료는 72시간으로 둔다.
7. ~~한마디 문장 API, 이름 후보 API는 만들지 않는다.~~ → [ADR-003](ADR-003-phrase-sets-and-api.md)(한마디 API), [ADR-004](ADR-004-llm-name-suggestions.md)(이름 후보 API)로 바뀜. 도장 응답의 `progress`도 ADR-003에 따라 카테고리별 배열이 됐다.

## 검토한 대안

| 대안 | 장점 | 버린 이유 |
|---|---|---|
| A. 초안대로 `POST /api/phrases/{id}/attempts` | retry까지 한 API로 기록, 통계 자료가 많아짐 | FE는 retry 때 서버를 부르지 않는다. FE `Store`와 모양이 달라 FE 쪽 어댑터가 생긴다. retry 기록 필요성은 아직 미정(H-2) |
| B. 도장 POST가 진행도만 반환 | 응답이 작음 | FE `addStamp`는 저장 뒤 전체 목록(시각 포함)을 기대한다. 그러면 FE가 GET을 한 번 더 불러야 해서 「1분 안에 도장 하나」 기준에 요청이 하나 늘어난다 |
| C. 도장 POST가 목록만 반환 (FE 요청서 그대로) | FE 요청과 정확히 같음 | 진행도를 FE·BE가 각각 계산하면 어긋날 수 있다. 진행도를 같이 줘도 필드 추가라 FE가 깨지지 않는다 |
| D. 이미 있는 도장은 409 | 새 도장인지 구분 가능 | FE는 실패 시 재전송한다. 재전송이 에러가 되면 FE가 409를 성공으로 다뤄야 하고 낙관적 UI와 어긋난다 |

## 결과와 트레이드오프

- 좋아지는 점: FE는 `src/api/`에 같은 모양의 Store를 만들어 `main.tsx`에서 바꿔 끼우기만 하면 된다. 화면·흐름 코드는 그대로다.
- 잃는 점: retry 데이터가 쌓이지 않는다. 발표 때 "몇 번 다시 말했는지" 같은 통계는 지금은 낼 수 없다.
- backend/CLAUDE.md의 attempts 관련 규칙·테스트는 보류로 옮긴다.

## 보류 항목

| # | 질문 | 지금 동작 | 정해지면 할 일 |
|---|---|---|---|
| H-1 | `stamped_at`을 FE가 보낸 시각으로 저장할까 (FE 요청서 규칙 2) | 서버 시각. 요청 필드 없음(보내도 무시) | 선택 필드 추가 + 허용 범위(미래 시각, 행사 전 시각) 규칙. 이 ADR 갱신 |
| H-2 | retry를 기록할까 | 기록 안 함 | `attempts` 테이블 + `POST /api/me/attempts`, FE에 호출 추가 요청. 이 ADR 갱신 |
