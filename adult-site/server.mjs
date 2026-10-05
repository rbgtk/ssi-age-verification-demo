import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 8080)
const verifierUrl = (process.env.VERIFIER_API_URL || 'http://localhost:7004').replace(/\/$/, '')
const credentialVct = process.env.AGE_CREDENTIAL_VCT || 'http://host.docker.internal:7005/openid4vci/AgeCredential'
const ttlMs = Number(process.env.VERIFICATION_TTL_MS || 5 * 60_000)
const flows = new Map()
const accessSessions = new Map()

const json = (res, status, value, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers })
  res.end(JSON.stringify(value))
}
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2))
const cookie = (name, value, maxAge) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${maxAge === 0 ? '; Max-Age=0' : ''}`

function collect(node, key, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Object.prototype.hasOwnProperty.call(node, key)) out.push(node[key])
  for (const value of Object.values(node)) collect(value, key, out)
  return out
}

export function interpretVerification(info) {
  const statuses = collect(info, 'status').filter(v => typeof v === 'string').map(v => v.toLowerCase())
  const errors = collect(info, 'error').concat(collect(info, 'errors')).filter(Boolean)
  const terminalFailure = statuses.some(v => /reject|declin|fail|error|invalid|cancel/.test(v)) || errors.length > 0
  if (terminalFailure) return { status: 'rejected', message: 'The wallet declined the request or the presentation was invalid.' }
  if (statuses.some(v => /expir/.test(v))) return { status: 'expired', message: 'The verification session expired. Please start again.' }

  const verifiedFlags = collect(info, 'verified').concat(collect(info, 'valid')).filter(v => typeof v === 'boolean')
  const terminalSuccess = statuses.some(v => /success|verified|complete|done/.test(v)) || verifiedFlags.includes(true)
  if (!terminalSuccess) return { status: 'pending', message: 'Waiting for your wallet…' }

  const ageClaims = collect(info, 'age_over_18')
  if (ageClaims.length !== 1 || typeof ageClaims[0] !== 'boolean') {
    return { status: 'rejected', message: 'The verified presentation did not contain one valid 18+ claim.' }
  }
  return ageClaims[0]
    ? { status: 'success', message: 'Your 18+ proof was verified. No identity details were stored.' }
    : { status: 'underage', message: 'This credential does not prove that its holder is over 18.' }
}

function getCreationFields(body) {
  const id = body.sessionId || body.id || body.session?.id
  const authorizationUrl = body.fullAuthorizationRequestUrl || body.authorizationRequestUrl || body.requestUrl || body.url
  if (typeof id !== 'string' || typeof authorizationUrl !== 'string') throw new Error('Unexpected verifier response')
  return { id, authorizationUrl }
}

async function startVerification(req, res) {
  const response = await fetch(`${verifierUrl}/verification-session/create`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      flow_type: 'cross_device',
      core_flow: {
        dcql_query: { credentials: [{ id: 'age_credential', format: 'dc+sd-jwt', meta: { vct_values: [credentialVct] }, claims: [{ path: ['age_over_18'] }] }] },
        expiration_duration: 'PT5M',
      },
    }),
  })
  if (!response.ok) throw new Error(`Verifier returned ${response.status}`)
  const created = getCreationFields(await response.json())
  const id = randomUUID(), owner = randomUUID()
  flows.set(id, { verifierId: created.id, owner, createdAt: Date.now(), consumed: false })
  json(res, 201, { id, authorizationUrl: created.authorizationUrl }, { 'set-cookie': cookie('av_flow', owner) })
}

async function verificationStatus(req, res, id) {
  const flow = flows.get(id)
  if (!flow || cookies(req).av_flow !== flow.owner) return json(res, 404, { status: 'expired', message: 'This verification session is unavailable.' })
  if (Date.now() - flow.createdAt > ttlMs) { flows.delete(id); return json(res, 410, { status: 'expired', message: 'The verification session expired. Please start again.' }) }
  if (flow.consumed) return json(res, 409, { status: 'expired', message: 'This verification result has already been used.' })

  const response = await fetch(`${verifierUrl}/verification-session/${encodeURIComponent(flow.verifierId)}/info`)
  if (!response.ok) throw new Error(`Verifier returned ${response.status}`)
  const outcome = interpretVerification(await response.json())
  if (outcome.status === 'success') {
    flow.consumed = true
    const accessId = randomUUID()
    accessSessions.set(accessId, { createdAt: Date.now() })
    return json(res, 200, outcome, { 'set-cookie': cookie('av_access', accessId) })
  }
  if (outcome.status !== 'pending') flow.consumed = true
  json(res, 200, outcome)
}

function hasAccess(req) { return accessSessions.has(cookies(req).av_access) }
function serve(res, file) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' })
  createReadStream(file).pipe(res)
}

export function createAppServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    try {
      if (req.method === 'POST' && url.pathname === '/api/verification/start') return await startVerification(req, res)
      const match = req.method === 'GET' && url.pathname.match(/^\/api\/verification\/([^/]+)\/status$/)
      if (match) return await verificationStatus(req, res, match[1])
      if (req.method === 'GET' && url.pathname === '/api/access') return json(res, 200, { allowed: hasAccess(req) })
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        const access = cookies(req).av_access; if (access) accessSessions.delete(access)
        return json(res, 200, { allowed: false }, { 'set-cookie': cookie('av_access', '', 0) })
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' })
      if (url.pathname === '/adult' && !hasAccess(req)) { res.writeHead(302, { location: '/verify?reason=required' }); return res.end() }
      const candidate = normalize(join(dist, url.pathname === '/' ? 'index.html' : url.pathname))
      if (candidate.startsWith(dist) && existsSync(candidate)) return serve(res, candidate)
      if (existsSync(join(dist, 'index.html'))) return serve(res, join(dist, 'index.html'))
      json(res, 503, { error: 'Frontend has not been built. Run npm run build.' })
    } catch {
      json(res, 502, { error: 'The verification service is unavailable.' })
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createAppServer().listen(port, '0.0.0.0', () => console.log(`Adult site listening on ${port}`))
