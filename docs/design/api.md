# API 명세 (설계)

> 상태: 설계 (구현 전) · 작성 2026-11-27 · 담당 태원
> 구현이 끝나면 계약의 원본은 [`docs/api/openapi.json`](../api/openapi.json)이다. 이 문서와 다르면 openapi.json이 맞다.
> 출발점: FE 요청서 "프론트가 필요한 API (제안)". 다른 점은 §10에 모았다.

## 공통

- 기본 경로 `/api`. 요청·응답 본문은 JSON(UTF-8).
- 인증이 필요한 API는 `Authorization: Bearer <access_token>`. 없거나 잘못되면 401 `unauthorized`.
- 에러 형식은 항상 `{"code": "...", "message_ja": "..."}`.
- 시각은 ISO 8601, UTC (`2026-11-29T05:00:00Z`).

| tag | 엔드포인트 | 인증 | 근거 |
|---|---|---|---|
| health | `GET /api/health` (있음) | – | |
| auth | `POST /api/auth/login` | – | ADR-001 |
| me | `GET /api/me` | ✓ | ADR-001 |
| me | `PUT /api/me/profile` | ✓ | ADR-001 |
| stamps | `GET /api/me/stamps` | ✓ | ADR-001, ADR-003 |
| stamps | `POST /api/me/stamps` | ✓ | ADR-001, ADR-003 |
| phrases | `GET /api/phrase-sets` | – | ADR-003 |
| phrases | `GET /api/phrases` | – | ADR-003 |
| names | `POST /api/names/suggest` | ✓ | ADR-004 |

---

## 1. `POST /api/auth/login`: 로그인 (M1)

요청
```json
{ "login_id": "judge01", "password": "4821" }
```
서버가 `login_id`는 NFKC → trim → 소문자, `password`는 NFKC → trim 한 뒤 비교한다.

응답 200
```json
{ "access_token": "eyJ...", "token_type": "bearer", "account_id": "judge01", "expires_in": 259200 }
```

| status | code | message_ja |
|---|---|---|
| 401 | `invalid_credentials` | IDかパスワードが違います |

## 2. `GET /api/me`: 내 정보

응답 200
```json
{ "account_id": "judge01", "animal": null, "korean_name": null }
```
`animal`: `"tiger" | "rabbit" | "magpie" | "bear" | null`, `korean_name`: string | null.

`korean_name`: `null` = 아직 안 정함, `""` = 이름을 패스함(동물만 있는 도장), 그 밖 = 고른 한글 이름. FE는 `animal`과 `korean_name`이 둘 다 null이 아니면 한마디판, 아니면 설정 화면으로 간다.

## 3. `PUT /api/me/profile`: 동물·한국식 이름 저장

요청 (전체 덮어쓰기, 두 키 모두 필수)
```json
{ "animal": "tiger", "korean_name": "양자" }
```
`korean_name`은 null, `""`(이름 패스), 또는 `^[가-힣]{1,10}$` (앞뒤 공백은 서버가 지움. 공백만 있으면 `""`로 본다).

이름 패스 예: `{ "animal": "tiger", "korean_name": "" }`

응답 200: `GET /api/me`와 같은 모양.

| status | code | message_ja |
|---|---|---|
| 422 | `invalid_profile` | 動物か名前を確認してください |

## 4. `GET /api/me/stamps`: 도장 목록과 카테고리별 진행도 (M2, M7)

응답 200
```json
{
  "stamps": [
    { "phrase_id": "q1", "set_code": "hackathon", "stamped_at": "2026-11-29T05:00:00Z" },
    { "phrase_id": "q3", "set_code": "hackathon", "stamped_at": "2026-11-29T05:04:12Z" }
  ],
  "progress": [
    { "set_code": "hackathon", "count": 2, "total": 6, "completed": false }
  ]
}
```

- `stamps`: 활성 한마디만, `stamped_at` 오름차순. `set_code`는 FE가 카테고리별로 나누기 쉽게 같이 준다.
- `progress`: 활성 카테고리 **전부**, `phrase_sets.sort_order` 순. 도장이 없는 카테고리도 `count: 0`으로 들어간다.
- 완료(`completed`)는 카테고리별이다. 전체 완료 여부가 필요하면 FE가 `progress.every(p => p.completed)`로 계산한다.

## 5. `POST /api/me/stamps`: 도장 받기 (M6 「알아들었어요」, M7)

요청
```json
{ "phrase_id": "q1" }
```

응답 200: `GET /api/me/stamps`와 같은 모양 (저장 뒤 전체).

| status | code | message_ja |
|---|---|---|
| 404 | `unknown_phrase` | この一言は見つかりませんでした |

- **멱등**: 이미 받은 도장이면 첫 시각을 그대로 두고 같은 응답 200.
- `stamped_at`은 서버 시각이다. FE가 보내도 지금은 무시한다(보류 H-1).

## 6. `GET /api/phrase-sets`: 카테고리 목록

응답 200
```json
{
  "phrase_sets": [
    { "code": "hackathon", "name_ja": "ハッカソン会場", "phrase_count": 6 }
  ]
}
```
활성 카테고리만, `sort_order` 순. 인증 없음(공개 콘텐츠).

## 7. `GET /api/phrases?set_code=hackathon`: 한마디 목록

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `set_code` | 아니오 | 없으면 활성 한마디 전부 |

응답 200
```json
{
  "phrases": [
    {
      "id": "q1",
      "set_code": "hackathon",
      "label": "はじめまして",
      "ko": "어떤 앱인가요?",
      "kana": "オットン エビンガヨ?",
      "ja": "どんなアプリですか？",
      "when": "他のチームのブースに初めて行ったとき",
      "reply": "일본인을 위한 ○○ 앱이에요",
      "reply_kana": "イルボニヌル ウィハン ○○ エビエヨ",
      "reply_ja": "日本人のための○○アプリです"
    }
  ]
}
```

| status | code | message_ja |
|---|---|---|
| 404 | `unknown_phrase_set` | このカテゴリは見つかりませんでした |

- 필드 이름은 FE `Phrase` 타입(`phrases.json`)과 같게 하되 API 규칙대로 snake_case(`replyKana` → `reply_kana`)로 쓴다. FE `src/api/`에서 한 번 바꾼다.
- 순서: 카테고리 안 `sort_order` 순.
- 응답에 `Cache-Control: public, max-age=300`을 단다. 문장은 고정 콘텐츠라서다.
- **FE 사용 방식(제안)**: 로그인 직후 `/me`, `/me/stamps`와 같이 한 번 받아 두고, 실패하면 번들의 `phrases.json`을 쓴다. 카드 탭 때는 네트워크를 기다리지 않는다.

## 8. `POST /api/names/suggest`: 한국식 이름 후보 (LLM)

FE의 `NameGenerator = (fullName) => Promise<NameCandidate[]>`(`frontend/src/core/types.ts`)를 그대로 서버로 옮긴 모양이다.

요청
```json
{ "ja_name": "田中 陽子" }
```

| 필드 | 규칙 |
|---|---|
| `ja_name` | 일본 이름 **전체(성+이름)**. 서버가 NFKC → trim → 연속 공백을 하나로 바꾼 뒤 1~30자여야 한다. 이름만 넣어도 된다 |

응답 200 (`name`, `note`는 FE `NameCandidate {name, note?}`와 같은 이름)
```json
{
  "candidates": [
    { "name": "전양자", "note": "「田」と「陽子」の韓国語読み" },
    { "name": "전요코", "note": "「田」を韓国の姓に、名前は音のまま" },
    { "name": "전서연", "note": "「陽子」の明るい印象に近い韓国の名前" }
  ]
}
```

- `candidates`는 항상 3개다. `name`은 `^[가-힣]{1,10}$`, 서로 다르다. `note`는 왜 이 이름인지(일본어, 1~40자).
- 짓는 규칙: **성에서 한 글자를 골라 한국 성처럼 + 이름을 한국 이름처럼**. 성이 없으면 이름만 한국식으로. 자세한 프롬프트 규칙은 [구성 계획](backend-architecture.md) §6.
- 같은 `ja_name`(정규화 기준)이면 같은 후보가 나온다(서버 캐시).
- 서버는 LLM을 최대 `NAME_SUGGEST_TIMEOUT_SECONDS`(기본 10초, API 최소값) 기다린다. FE는 3초 뒤 자체 규칙으로 대신한다.
- 한글로 넣은 이름은 FE가 서버를 부르지 않고 그대로 쓴다(`hangulName()`). 서버는 따로 처리하지 않는다.

| status | code | message_ja | FE 동작 |
|---|---|---|---|
| 422 | `invalid_ja_name` | 名前を確認してください | 입력 안내 |
| 503 | `name_suggest_unavailable` | いまは候補を作れません | **임시 규칙(`temporaryNameGenerator`)으로 후보를 보여 준다** |

FE는 서버 구현을 `NameGenerator`로 감싸 `main.tsx`에서 바꿔 끼운다. 503·3초 초과·네트워크 오류면 같은 자리에서 `temporaryNameGenerator`로 대비한다. 고른 이름은 기존대로 `PUT /api/me/profile`로 저장한다.

FE 설정 화면은 입력이 멈추고 500ms 뒤에 이름 짓기를 부른다(디바운스). 그래서 입력 중간값(`田中`, `田中 陽`)으로도 요청이 갈 수 있다. 서버는 인증·캐시·30자 제한으로 감당한다.

## 9. 공통 401

```json
{ "code": "unauthorized", "message_ja": "ログインが必要です。" }
```
토큰 없음, 형식 오류, 서명 불일치, 만료, 계정 없음 모두 같다.

## 10. FE 요청서와 다른 점

| FE 요청서 | 이 명세 | 근거 |
|---|---|---|
| 도장 응답 `{stamps}` | `{stamps, progress[]}`, 도장마다 `set_code` | ADR-001, ADR-003 (카테고리별 완료) |
| 요청에 `stamped_at`, FE 시각으로 저장 | 서버 시각, 요청 필드 없음 | 보류 H-1 |
| 로그인 응답 | `expires_in` 추가 | 선택적으로 사용 |
| 토큰 12시간 이상 | 72시간 | 행사 기간 전체 |
| 한마디 문장 API 필요 없음 | `GET /api/phrase-sets`, `GET /api/phrases` 추가 | ADR-003 |
| 이름 후보 API 필요 없음 | `POST /api/names/suggest` 추가 (LLM), 응답은 FE `NameCandidate {name, note}` 모양 | ADR-004 |
| `korean_name` 한글 1~10자 | `""`(이름 패스)도 허용 | FE PR #2 |
| 한마디 필드 | `label` 포함 | FE PR #2 |
| `GET /api/stats` (P2) | 이번 범위 밖 | 승환 담당 |
