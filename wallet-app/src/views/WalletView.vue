<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, json, session } from '@/api'
// API responses vary by credential format and intentionally contain arbitrary JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>
const router = useRouter()
const wallets = ref<string[]>([])
const walletId = ref('')
const keys = ref<Obj[]>([])
const dids = ref<Obj[]>([])
const walletInfo = ref<Obj>({})
const credentials = ref<Obj[]>([])
const tab = ref('credentials')
const error = ref('')
const message = ref('')
const busy = ref(false)
const offer = ref('')
const txCode = ref('')
const importKey = ref('')
const keyType = ref('Ed25519')
const keyModal = ref<'generate' | 'import' | null>(null)
const presentUrl = ref('')
const preview = ref<Obj | null>(null)
async function guarded(fn: () => Promise<void>) {
  busy.value = true
  error.value = ''
  message.value = ''
  try {
    await fn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    error.value = msg
    if (/401|unauthor/i.test(msg)) {
      session.token = ''
      router.push('/auth')
    }
  } finally {
    busy.value = false
  }
}
async function loadWallets() {
  await guarded(async () => {
    wallets.value = await api<string[]>('/wallet')
    if (!walletId.value && wallets.value.length) walletId.value = wallets.value[0]!
    if (walletId.value) await loadData()
  })
}
async function loadData() {
  ;[walletInfo.value, keys.value, dids.value, credentials.value] = await Promise.all([
    api<Obj>(`/wallet/${walletId.value}`),
    api<Obj[]>(`/wallet/${walletId.value}/keys`),
    api<Obj[]>(`/wallet/${walletId.value}/dids`),
    api<Obj[]>(`/wallet/${walletId.value}/credentials?showDeleted=false&showPending=false`),
  ])
  await applyDefaultInvariants()
}
async function applyDefaultInvariants() {
  if (keys.value.length === 1 && walletInfo.value.defaultKeyId !== keys.value[0]?.keyId) {
    const onlyKeyId = String(keys.value[0]?.keyId)
    await api(`/wallet/${walletId.value}/keys/${encodeURIComponent(onlyKeyId)}/set-default`, {
      method: 'PUT',
    })
    walletInfo.value = { ...walletInfo.value, defaultKeyId: onlyKeyId }
  }

  const defaultKeyDids = walletInfo.value.defaultKeyId
    ? linkedDids(String(walletInfo.value.defaultKeyId))
    : []
  const automaticDid =
    defaultKeyDids.length === 1
      ? defaultKeyDids[0]?.did
      : dids.value.length === 1
        ? dids.value[0]?.did
        : undefined
  if (automaticDid && walletInfo.value.defaultDidId !== automaticDid) {
    await api(
      `/wallet/${walletId.value}/dids/${encodeURIComponent(String(automaticDid))}/set-default`,
      { method: 'PUT' },
    )
    walletInfo.value = { ...walletInfo.value, defaultDidId: automaticDid }
  }
}
async function createWallet() {
  await guarded(async () => {
    const r = await api<{ walletId: string }>('/wallet', {
      method: 'POST',
      body: json({ noDidStore: false }),
    })
    walletId.value = r.walletId
    await api(`/auth/account/wallets/${r.walletId}`, { method: 'POST' }).catch(() => undefined)
    await loadWallets()
    message.value = 'Wallet created.'
  })
}
async function generateKey() {
  await guarded(async () => {
    await api(`/wallet/${walletId.value}/keys/generate`, {
      method: 'POST',
      body: json({ backend: 'jwk', keyType: keyType.value }),
    })
    await loadData()
    keyModal.value = null
    message.value = 'Key generated.'
  })
}
async function doImportKey() {
  await guarded(async () => {
    await api(`/wallet/${walletId.value}/keys/import`, {
      method: 'POST',
      body: json({ key: JSON.parse(importKey.value) }),
    })
    importKey.value = ''
    await loadData()
    keyModal.value = null
    message.value = 'Key imported.'
  })
}
async function setDefaultKey(id: string) {
  await guarded(async () => {
    await api(`/wallet/${walletId.value}/keys/${encodeURIComponent(id)}/set-default`, {
      method: 'PUT',
    })
    walletInfo.value = { ...walletInfo.value, defaultKeyId: id }
    await applyDefaultInvariants()
    message.value = 'Default key updated.'
  })
}
async function deleteKey(id: string) {
  if (!window.confirm('Delete this key from the wallet? Any DID that uses it may stop working.')) return
  await guarded(async () => {
    await api(`/wallet/${walletId.value}/keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await loadData()
    message.value = 'Key deleted.'
  })
}
async function createDid(keyId?: string) {
  await guarded(async () => {
    const entry = await api<Obj>(`/wallet/${walletId.value}/dids/create`, {
      method: 'POST',
      body: json({ method: 'jwk', keyId, options: {} }),
    })
    if (keyId && entry.did) {
      const links = readDidKeyLinks()
      links[String(entry.did)] = keyId
      localStorage.setItem(linkStorageKey(), JSON.stringify(links))
    }
    await loadData()
    message.value = 'did:jwk created.'
  })
}
async function setDefaultDid(did: string) {
  await guarded(async () => {
    await api(`/wallet/${walletId.value}/dids/${encodeURIComponent(did)}/set-default`, {
      method: 'PUT',
    })
    walletInfo.value = { ...walletInfo.value, defaultDidId: did }
    message.value = 'Default DID updated.'
  })
}
async function deleteDid(did: string) {
  if (!window.confirm('Delete this DID from the wallet? This does not delete its key.')) return
  await guarded(async () => {
    await api(`/wallet/${walletId.value}/dids/${encodeURIComponent(did)}`, { method: 'DELETE' })
    const links = readDidKeyLinks()
    delete links[did]
    localStorage.setItem(linkStorageKey(), JSON.stringify(links))
    await loadData()
    message.value = 'DID deleted. Its key remains in the wallet.'
  })
}
function linkStorageKey() {
  return `age-wallet-did-key-links:${walletId.value}`
}
function readDidKeyLinks(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(linkStorageKey()) || '{}')
  } catch {
    return {}
  }
}
function didReferencesKey(did: Obj, keyId: string) {
  if (readDidKeyLinks()[String(did.did)] === keyId) return true
  const methods = Array.isArray(did.document?.verificationMethod)
    ? did.document.verificationMethod
    : []
  const references = methods.flatMap((method: Obj) => [
    method.id,
    method.publicKeyJwk?.kid,
    method.publicKeyMultibase,
  ])
  return references.some((value: unknown) => {
    if (typeof value !== 'string') return false
    const fragment = value.includes('#') ? value.slice(value.lastIndexOf('#') + 1) : value
    return fragment === keyId || fragment.includes(keyId) || keyId.includes(fragment)
  })
}
function linkedDids(keyId: string) {
  return dids.value.filter((did) => didReferencesKey(did, keyId))
}
async function acceptOffer() {
  await guarded(async () => {
    let offerUrl = offer.value.trim()
    let offerJson: Obj | undefined
    if (offerUrl.startsWith('{')) {
      offerJson = JSON.parse(offerUrl)
      offerUrl = ''
    }
    const body: Obj = { clientId: '', redirectUri: '', tokenRequestHeaders: {} }
    if (offerUrl) body.offerUrl = offerUrl
    if (offerJson) body.offerJson = offerJson
    if (txCode.value) body.txCode = txCode.value
    const defaultDid = walletInfo.value.defaultDidId || dids.value[0]?.did
    if (defaultDid) body.did = defaultDid
    await api(`/wallet/${walletId.value}/credentials/receive`, { method: 'POST', body: json(body) })
    offer.value = ''
    txCode.value = ''
    await loadData()
    message.value = 'Credential accepted and stored.'
  })
}
async function inspectPresentation() {
  await guarded(async () => {
    const requestUrl = presentUrl.value.trim()
    if (!requestUrl) throw new Error('Paste an OpenID4VP request URL first.')
    preview.value = null
    preview.value = await api(`/wallet/${walletId.value}/credentials/present/preview`, {
      method: 'POST',
      body: json({ requestUrl }),
    })
    tab.value = 'present'
  })
}
function requestedClaims(request: Obj) {
  const queries = request.authorizationRequest?.dcql_query?.credentials
  if (!Array.isArray(queries)) return []
  return queries.flatMap((query: Obj) => {
    const claims = Array.isArray(query.claims) ? query.claims : []
    return claims.map((claim: Obj) => ({
      credential: query.id || query.meta?.vct_values?.[0] || 'Credential',
      claim: Array.isArray(claim.path) ? claim.path.join('.') : String(claim.path || 'Claim'),
    }))
  })
}
async function present() {
  await guarded(async () => {
    const result = await api<Obj>(`/wallet/${walletId.value}/credentials/present`, {
      method: 'POST',
      body: json({ requestUrl: presentUrl.value, runPolicies: true }),
    })
    message.value =
      result.transmission_success === false
        ? 'Verifier did not accept the presentation.'
        : 'Presentation sent.'
    if (result.redirect_to) location.href = result.redirect_to
    preview.value = null
  })
}
onMounted(async () => {
  if (!session.token) {
    router.push(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`)
    return
  }
  await loadWallets()
})
</script>
<template>
  <div class="row between hero">
    <div>
      <span class="pill">Self-sovereign wallet</span>
      <h1>Identity, without the oversharing.</h1>
    </div>
    <div class="row">
      <select
        v-if="wallets.length"
        v-model="walletId"
        aria-label="Active wallet"
        @change="guarded(loadData)"
      >
        <option v-for="id in wallets" :key="id" :value="id">{{ id }}</option></select
      ><button class="secondary" @click="createWallet">+ New wallet</button>
    </div>
  </div>
  <div v-if="!wallets.length" class="card empty">
    <h2>Create your first wallet</h2>
    <p class="muted">A wallet holds keys, DIDs and credentials for this account.</p>
    <button class="primary" @click="createWallet">Create wallet</button>
  </div>
  <template v-else
    ><div v-if="message" class="notice">{{ message }}</div>
    <div v-if="error" class="notice error">{{ error }}</div>
    <nav class="tabs">
      <button
        v-for="name in ['credentials', 'offers', 'present', 'keys']"
        :key="name"
        class="secondary"
        :class="{ active: tab === name }"
        @click="tab = name"
      >
        {{ name[0]?.toUpperCase() + name.slice(1) }}
      </button>
    </nav>
    <section v-if="tab === 'credentials'" class="grid">
      <div class="card">
        <h2>Credentials</h2>
        <p class="muted">Stored in the selected wallet.</p>
        <div v-if="!credentials.length" class="item muted">No credentials yet.</div>
        <div v-for="c in credentials" :key="c.id" class="item">
          <div class="row between">
            <strong>{{ c.label || 'Verifiable credential' }}</strong
            ><span class="pill">{{ c.format }}</span>
          </div>
          <small class="muted">{{ c.issuer || c.id }}</small>
        </div>
      </div>
      <div class="card">
        <h2>Wallet health</h2>
        <div class="item">
          <b>{{ keys.length }}</b> keys
        </div>
        <div class="item">
          <b>{{ dids.length }}</b> decentralized identifiers
        </div>
        <div class="item">
          <b>{{ credentials.length }}</b> credentials
        </div>
      </div>
    </section>
    <section v-if="tab === 'offers'" class="card stack">
      <div>
        <h2>Accept a credential offer</h2>
        <p class="muted">
          Paste an OpenID4VCI offer URL or offer JSON. It will be resolved and stored by your
          wallet.
        </p>
      </div>
      <label class="field"
        >Credential offer<textarea
          v-model="offer"
          placeholder="openid-credential-offer://… or { … }"
        ></textarea></label
      ><label class="field"
        >Transaction code (if requested)<input
          v-model="txCode"
          inputmode="numeric"
          placeholder="Optional PIN" /></label
      ><button class="primary" :disabled="busy || !offer" @click="acceptOffer">
        Review and accept offer
      </button>
    </section>
    <section v-if="tab === 'present'" class="grid">
      <div class="card stack">
        <div>
          <h2>Create a presentation</h2>
          <p class="muted">
            Paste a verifier request to preview which credential and claims will be shared.
          </p>
        </div>
        <label class="field"
          >Authorization request URL<textarea
            v-model="presentUrl"
            placeholder="openid4vp://..."
          ></textarea></label
        ><button class="secondary" :disabled="!presentUrl" @click="inspectPresentation">
          Preview request
        </button>
      </div>
      <div class="card">
        <h2>Consent preview</h2>
        <p v-if="!preview" class="muted">Nothing is shared until you preview and approve.</p>
        <template v-else
          ><div class="item">
            <b>Verifier</b><br /><span class="muted">{{
              preview.verifier?.name || preview.clientId || 'Unknown verifier'
            }}</span>
          </div>
          <div v-for="option in preview.credentialOptions" :key="option.credentialId" class="item">
            <b>{{ option.label || 'Credential' }}</b>
            <pre>{{ JSON.stringify(option.credentialData, null, 2) }}</pre>
          </div>
          <div v-if="requestedClaims(preview).length" class="item">
            <b>Requested claims</b>
            <div v-for="item in requestedClaims(preview)" :key="`${item.credential}:${item.claim}`" class="claim-row">
              <span>{{ item.claim }}</span>
              <small class="muted">{{ item.credential }}</small>
            </div>
          </div>
          <div v-if="!preview.valid" class="notice error">
            {{ preview.error?.message || 'This request is invalid.' }}
          </div>
          <button v-if="preview.valid" class="primary" :disabled="busy" @click="present">
            Approve and share
          </button></template
        >
      </div>
    </section>
    <section v-if="tab === 'keys'" class="keys-section">
      <div class="row key-actions">
        <button class="primary" @click="keyModal = 'generate'">+ Generate key</button>
        <button class="secondary" @click="keyModal = 'import'">Import key</button>
      </div>
      <div class="card key-list">
        <h2>Keys & matching DIDs</h2>
        <p class="muted">Create a DID from a specific key to keep their relationship explicit.</p>
        <div v-for="k in keys" :key="k.keyId" class="item">
          <div class="row between">
            <b>{{ k.keyType }}</b>
            <span v-if="walletInfo.defaultKeyId === k.keyId" class="pill default">Default key</span>
          </div>
          <small class="muted key-id">{{ k.keyId }}</small>
          <div v-if="linkedDids(k.keyId).length" class="linked-dids">
            <div v-for="d in linkedDids(k.keyId)" :key="d.did" class="did-link">
              <span class="link-line">↳</span>
              <div>
                <div class="row">
                  <span class="pill">did:jwk</span>
                  <span v-if="walletInfo.defaultDidId === d.did" class="pill default">Default DID</span>
                </div>
                <small class="key-id">{{ d.did }}</small>
                <div class="row">
                  <button v-if="walletInfo.defaultDidId !== d.did" class="quiet" @click="setDefaultDid(d.did)">Make default DID</button>
                  <button class="quiet danger" @click="deleteDid(d.did)">Delete DID</button>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="muted no-link">No DID is linked to this key yet.</p>
          <div class="row">
            <button v-if="walletInfo.defaultKeyId !== k.keyId" class="quiet" @click="setDefaultKey(k.keyId)">Make default key</button>
            <button class="secondary" @click="createDid(k.keyId)">
              {{ linkedDids(k.keyId).length ? 'Generate another DID' : 'Generate DID' }}
            </button>
            <button class="quiet danger" @click="deleteKey(k.keyId)">Delete key</button>
          </div>
        </div>
        <div v-if="!keys.length" class="item muted">No keys yet.</div>
        <div v-if="dids.some((did) => !keys.some((key) => didReferencesKey(did, key.keyId)))" class="item">
          <b>Unmatched DIDs</b>
          <p class="muted">These DIDs were imported or created without relationship metadata.</p>
          <div v-for="d in dids.filter((did) => !keys.some((key) => didReferencesKey(did, key.keyId)))" :key="d.did" class="orphan-did">
            <span class="pill">DID</span>
            <span v-if="walletInfo.defaultDidId === d.did" class="pill default">Default DID</span>
            <small>{{ d.did }}</small>
            <div class="row">
              <button v-if="walletInfo.defaultDidId !== d.did" class="quiet" @click="setDefaultDid(d.did)">Make default DID</button>
              <button class="quiet danger" @click="deleteDid(d.did)">Delete DID</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="keyModal" class="modal-backdrop" @click.self="keyModal = null">
        <section class="card modal" role="dialog" aria-modal="true" :aria-label="keyModal === 'generate' ? 'Generate key' : 'Import key'">
          <div class="row between">
            <div>
              <h2>{{ keyModal === 'generate' ? 'Generate a key' : 'Import a JWK' }}</h2>
              <p class="muted">{{ keyModal === 'generate' ? 'Create a private key inside this wallet.' : 'Paste a JSON Web Key, including private key material.' }}</p>
            </div>
            <button class="quiet modal-close" aria-label="Close" @click="keyModal = null">×</button>
          </div>
          <template v-if="keyModal === 'generate'">
            <label class="field">Algorithm<select v-model="keyType"><option>Ed25519</option><option>secp256r1</option><option>secp256k1</option></select></label>
            <button class="primary" :disabled="busy" @click="generateKey">Generate key</button>
          </template>
          <template v-else>
            <label class="field">JSON Web Key<textarea v-model="importKey" placeholder='{ "kty": "OKP", … }'></textarea></label>
            <button class="primary" :disabled="busy || !importKey" @click="doImportKey">Import key</button>
          </template>
          <div v-if="error" class="notice error">{{ error }}</div>
        </section>
      </div>
    </section></template
  >
</template>
<style scoped>
.hero {
  margin-bottom: 28px;
}
.hero h1 {
  margin: 8px 0 0;
}
.hero select {
  max-width: 280px;
}
.notice {
  margin-bottom: 18px;
}
.empty {
  text-align: center;
  padding: 60px 24px;
}
.tabs {
  margin-top: 22px;
}
small {
  line-height: 1.4;
}
.keys-section {
  display: grid;
  gap: 18px;
}
.key-actions {
  justify-content: flex-end;
}
.key-id,
.orphan-did small {
  display: block;
  overflow-wrap: anywhere;
  margin: 6px 0 12px;
}
.default {
  color: #dcd3ff;
  background: #7957ff55;
  border: 1px solid #9c84ff88;
}
.linked-dids {
  margin: 14px 0;
  padding-left: 8px;
  border-left: 1px solid #ffffff20;
}
.did-link {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 8px;
  padding: 10px 0;
  overflow-wrap: anywhere;
}
.link-line {
  color: #8c6cff;
}
.no-link {
  margin: 14px 0;
}
.orphan-did {
  padding-top: 10px;
}
.claim-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 10px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 20px;
  background: #05060bcc;
  backdrop-filter: blur(8px);
}
.modal {
  display: grid;
  gap: 18px;
  width: min(520px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
}
.modal h2 {
  margin-bottom: 5px;
}
.modal p {
  margin-bottom: 0;
}
.modal-close {
  align-self: flex-start;
  padding: 2px 8px;
  font-size: 1.8rem;
  line-height: 1;
}
</style>
