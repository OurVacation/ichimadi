// 검사용 메모리 저장소 (localStorage와 같은 모양)
export function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

export type Call = { method: string; url: string; headers: Record<string, string>; body: unknown }

/**
 * 가짜 fetch. reply가 돌려준 값이 응답이 된다: [status, 본문] 또는 'hang'(시간 초과까지 답 없음), 'offline'(통신 실패).
 * 받은 요청은 calls에 쌓인다.
 */
export function fakeFetch(reply: (call: Call) => [number, unknown] | 'hang' | 'offline') {
  const calls: Call[] = []
  const fetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const call: Call = {
      method: init.method ?? 'GET',
      url: String(input),
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const r = reply(call)
    if (r === 'offline') throw new TypeError('Failed to fetch')
    if (r === 'hang') {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }
    const [status, body] = r
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }
  return { fetch: fetch as typeof globalThis.fetch, calls }
}
