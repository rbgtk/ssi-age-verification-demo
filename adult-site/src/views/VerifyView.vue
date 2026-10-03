<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

type State = 'idle' | 'pending' | 'success' | 'underage' | 'rejected' | 'expired' | 'error'
const state = ref<State>('idle')
const message = ref('')
const router = useRouter()
let timer: number | undefined

async function start() {
  state.value = 'pending'; message.value = 'Waiting for your wallet…'
  const walletWindow = window.open('', 'age-wallet')
  try {
    const response = await fetch('/api/verification/start', { method: 'POST', credentials: 'same-origin' })
    if (!response.ok) throw new Error('The verifier could not start a session.')
    const body = await response.json() as { id: string; walletUrl: string }
    if (!walletWindow) throw new Error('Allow pop-ups for this site so the wallet can open.')
    walletWindow.location.href = body.walletUrl
    timer = window.setInterval(() => check(body.id), 1200)
  } catch (error) { walletWindow?.close(); state.value = 'error'; message.value = error instanceof Error ? error.message : 'Verification failed.' }
}

async function check(id: string) {
  try {
    const response = await fetch(`/api/verification/${encodeURIComponent(id)}/status`, { credentials: 'same-origin' })
    const body = await response.json() as { status: State; message?: string }
    if (body.status === 'pending') return
    if (timer) clearInterval(timer)
    state.value = body.status; message.value = body.message ?? ''
    if (body.status === 'success') window.setTimeout(() => router.push('/adult'), 700)
  } catch { if (timer) clearInterval(timer); state.value = 'error'; message.value = 'Could not reach the verification service.' }
}
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <section class="verify-shell">
    <div class="panel">
      <p class="eyebrow">18+ checkpoint</p>
      <template v-if="state === 'idle'">
        <h1>Enter without introducing yourself.</h1>
        <p>Your wallet will be asked for one selectively disclosed boolean claim. Check the request, then approve or reject it yourself.</p>
        <button class="button" @click="start">Open my wallet <span>→</span></button>
        <aside><strong>What the site receives</strong><code>{ "age_over_18": true | false }</code><small>No name · No date of birth · No ID number</small></aside>
      </template>
      <template v-else>
        <div class="status-icon" :class="state">{{ state === 'pending' ? '…' : state === 'success' ? '✓' : '!' }}</div>
        <h1>{{ state === 'pending' ? 'Check your wallet' : state === 'success' ? 'Verified' : state === 'underage' ? 'Access unavailable' : state === 'rejected' ? 'Request declined' : state === 'expired' ? 'Session expired' : 'Something went wrong' }}</h1>
        <p>{{ message }}</p>
        <button v-if="!['pending','success'].includes(state)" class="button secondary" @click="start">Try again</button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.verify-shell { min-height: calc(100vh - 136px); display: grid; place-items: center; padding: 55px 24px; }.panel { width: min(620px, 100%); border: 1px solid #ffffff1c; border-radius: 28px; padding: clamp(30px, 6vw, 62px); background: #121214e8; box-shadow: 0 30px 100px #000a; text-align: center; }.panel h1 { font: 700 clamp(38px, 6vw, 58px)/1.05 'Playfair Display',serif; margin: 17px 0 22px; }.panel > p:not(.eyebrow) { color: #aaa39c; line-height: 1.7; }.button { margin-top: 22px; }aside { margin-top: 38px; padding: 20px; border-radius: 14px; background: #09090b; display: grid; gap: 10px; }aside strong { font-size: 12px; color: #d4788c; text-transform: uppercase; letter-spacing: .1em; }code { color: #e9ded7; }small { color: #6e6864; }.status-icon { margin: 12px auto 30px; width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; font-size: 32px; border: 1px solid #e05a76; color: #f38aa0; }.status-icon.success { border-color:#54c59b;color:#54c59b}.status-icon.pending{animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.45;transform:scale(.95)}}
</style>
