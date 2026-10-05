const TOKEN_KEY = 'age-wallet-token'

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY) || '' },
  set token(value: string) {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  },
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (session.token) headers.set('authorization', `Bearer ${session.token}`)
  const response = await fetch(`/wallet-api${path}`, { ...init, headers })
  const text = await response.text()
  let body: unknown = text
  try { body = text ? JSON.parse(text) : undefined } catch { /* plain text response */ }
  if (!response.ok) {
    const detail = typeof body === 'object' && body && 'message' in body ? String((body as { message: unknown }).message) : text
    throw new Error(detail || `${response.status} ${response.statusText}`)
  }
  return body as T
}

export const json = (value: unknown) => JSON.stringify(value)
