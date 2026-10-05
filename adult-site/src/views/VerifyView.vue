<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'

type State = 'idle' | 'pending' | 'success' | 'underage' | 'rejected' | 'expired' | 'error'
const state = ref<State>('idle')
const message = ref('')
const authorizationUrl = ref('')
const qrCode = ref('')
const copied = ref(false)
const router = useRouter()
let timer: number | undefined

async function start() {
  state.value = 'pending'
  message.value = 'Scan the QR code or open the request with any compatible wallet.'
  authorizationUrl.value = ''
  qrCode.value = ''
  copied.value = false
  try {
    const response = await fetch('/api/verification/start', {
      method: 'POST',
      credentials: 'same-origin',
    })
    if (!response.ok) throw new Error('The verifier could not start a session.')
    const body = (await response.json()) as { id: string; authorizationUrl: string }
    authorizationUrl.value = body.authorizationUrl
    qrCode.value = await QRCode.toDataURL(body.authorizationUrl, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
    timer = window.setInterval(() => check(body.id), 1200)
  } catch (error) {
    state.value = 'error'
    message.value = error instanceof Error ? error.message : 'Verification failed.'
  }
}

async function copyRequest() {
  await navigator.clipboard.writeText(authorizationUrl.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}

async function check(id: string) {
  try {
    const response = await fetch(`/api/verification/${encodeURIComponent(id)}/status`, {
      credentials: 'same-origin',
    })
    const body = (await response.json()) as { status: State; message?: string }
    if (body.status === 'pending') return
    if (timer) clearInterval(timer)
    state.value = body.status
    message.value = body.message ?? ''
    if (body.status === 'success') window.setTimeout(() => router.push('/adult'), 700)
  } catch {
    if (timer) clearInterval(timer)
    state.value = 'error'
    message.value = 'Could not reach the verification service.'
  }
}
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section class="verify-shell">
    <div class="panel">
      <p class="eyebrow">18+ checkpoint</p>
      <template v-if="state === 'idle'">
        <h1>Enter without introducing yourself.</h1>
        <p>
          Your wallet will be asked for one selectively disclosed boolean claim. Check the request,
          then approve or reject it yourself.
        </p>
        <button class="button" @click="start">Create verification request <span>→</span></button>
        <aside>
          <strong>What the site receives</strong><code>{ "age_over_18": true | false }</code
          ><small>No name · No date of birth · No ID number</small>
        </aside>
      </template>
      <template v-else>
        <div v-if="state !== 'pending'" class="status-icon" :class="state">
          {{ state === 'success' ? '✓' : '!' }}
        </div>
        <h1>
          {{
            state === 'pending'
              ? 'Open with your wallet'
              : state === 'success'
                ? 'Verified'
                : state === 'underage'
                  ? 'Access unavailable'
                  : state === 'rejected'
                    ? 'Request declined'
                    : state === 'expired'
                      ? 'Session expired'
                      : 'Something went wrong'
          }}
        </h1>
        <p>{{ message }}</p>
        <div v-if="state === 'pending' && authorizationUrl" class="wallet-request">
          <img
            v-if="qrCode"
            :src="qrCode"
            alt="QR code containing the OpenID4VP verification request"
            width="256"
            height="256"
          />
          <p class="scan-label">Scan with a wallet on another device</p>
          <div class="divider"><span>or</span></div>
          <a class="button" :href="authorizationUrl">Open in a wallet <span>↗</span></a>
          <button class="copy-button" type="button" @click="copyRequest">
            {{ copied ? 'Copied' : 'Copy request URL' }}
          </button>
          <code class="request-url">{{ authorizationUrl }}</code>
        </div>
        <div v-else-if="state === 'pending'" class="status-icon pending">…</div>
        <button
          v-if="!['pending', 'success'].includes(state)"
          class="button secondary"
          @click="start"
        >
          Try again
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.verify-shell {
  min-height: calc(100vh - 136px);
  display: grid;
  place-items: center;
  padding: 55px 24px;
}
.panel {
  width: min(660px, 100%);
  border: 1px solid #ffffff1c;
  border-radius: 28px;
  padding: clamp(30px, 6vw, 62px);
  background: #121214e8;
  box-shadow: 0 30px 100px #000a;
  text-align: center;
}
.panel h1 {
  font:
    700 clamp(38px, 6vw, 58px)/1.05 'Playfair Display',
    serif;
  margin: 17px 0 22px;
}
.panel > p:not(.eyebrow) {
  color: #aaa39c;
  line-height: 1.7;
}
.button {
  margin-top: 22px;
}
aside {
  margin-top: 38px;
  padding: 20px;
  border-radius: 14px;
  background: #09090b;
  display: grid;
  gap: 10px;
}
aside strong {
  font-size: 12px;
  color: #d4788c;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
code {
  color: #e9ded7;
}
small {
  color: #6e6864;
}
.status-icon {
  margin: 12px auto 30px;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 32px;
  border: 1px solid #e05a76;
  color: #f38aa0;
}
.status-icon.success {
  border-color: #54c59b;
  color: #54c59b;
}
.status-icon.pending {
  animation: pulse 1.2s infinite;
}
.wallet-request {
  margin-top: 28px;
  display: grid;
  justify-items: center;
}
.wallet-request img {
  display: block;
  width: min(256px, 100%);
  height: auto;
  padding: 10px;
  border-radius: 16px;
  background: #fff;
}
.scan-label {
  margin: 12px 0 0;
  color: #aaa39c;
  font-size: 14px;
}
.divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
  color: #6e6864;
  font-size: 12px;
  text-transform: uppercase;
}
.divider::before,
.divider::after {
  content: '';
  height: 1px;
  flex: 1;
  background: #ffffff18;
}
.wallet-request .button {
  margin-top: 18px;
}
.copy-button {
  margin-top: 12px;
  padding: 9px 14px;
  border: 0;
  background: transparent;
  color: #d4788c;
  cursor: pointer;
}
.copy-button:hover {
  color: #f29aae;
}
.request-url {
  width: 100%;
  margin-top: 10px;
  padding: 11px 13px;
  border: 1px solid #ffffff12;
  border-radius: 8px;
  background: #09090b;
  color: #77716c;
  font: 11px/1.45 monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@keyframes pulse {
  50% {
    opacity: 0.45;
    transform: scale(0.95);
  }
}
</style>
