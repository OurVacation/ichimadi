// 들어가기(내 정보·도장·한마디 받기)는 늦게 끝날 수 있다. 폰 하나를 둘이 쓰면 지난 계정의 응답이 새 계정 화면을 덮는다.
// 그래서 들어가기마다 번호를 매기고, 가장 최근 것이면서 지금 로그인한 계정일 때만 화면에 넣는다.
export type EnterGate = {
  /** 들어가기를 시작한다. 돌려준 함수가 true일 때만 결과를 화면에 넣는다 */
  begin(accountId: string): () => boolean
  /** 진행 중인 들어가기를 모두 버린다 (로그아웃, 다른 로그인) */
  cancel(): void
}

export function createEnterGate(currentAccount: () => string | null): EnterGate {
  let latest = 0
  return {
    begin(accountId) {
      const mine = ++latest
      return () => mine === latest && currentAccount() === accountId
    },
    cancel() {
      latest++
    },
  }
}
