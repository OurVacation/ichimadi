/** QR 카드 주소 끝의 `#login=<id>.<password>`. 각 부분은 encodeURIComponent로 들어 있다. */
export type LoginHash = { kind: 'none' } | { kind: 'malformed' } | { kind: 'login'; id: string; password: string }

const PREFIX = '#login='

export function parseLoginHash(hash: string): LoginHash {
  if (!hash.startsWith(PREFIX)) return { kind: 'none' }
  const body = hash.slice(PREFIX.length)
  const dot = body.indexOf('.')
  if (dot <= 0 || dot === body.length - 1) return { kind: 'malformed' }
  try {
    return {
      kind: 'login',
      id: decodeURIComponent(body.slice(0, dot)),
      password: decodeURIComponent(body.slice(dot + 1)),
    }
  } catch {
    return { kind: 'malformed' }
  }
}
