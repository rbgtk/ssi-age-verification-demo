<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
async function leave() { await fetch('/api/logout', { method: 'POST' }); await router.push('/') }
</script>
<template>
  <section class="members">
    <p class="eyebrow">Verified adults-only demo</p>
    <h1>Welcome behind the curtain.</h1>
    <p class="intro">This is intentionally ordinary content. The interesting part is that you reached it without handing over your identity.</p>
    <div class="tiles"><article><span>01</span><h2>Midnight Cinema</h2><p>A fictional collection of atmospheric film stills.</p></article><article><span>02</span><h2>After Dark Radio</h2><p>An imaginary late-night listening room.</p></article><article><span>03</span><h2>The Velvet Journal</h2><p>Made-up essays for a privacy demo.</p></article></div>
    <button class="button secondary" @click="leave">End private session</button>
  </section>
</template>
<style scoped>.members{max-width:1160px;margin:auto;padding:90px 32px 120px}.members h1{font:700 clamp(50px,7vw,82px)/1 'Playfair Display',serif;margin:18px 0 25px}.intro{color:#a59e97;font-size:19px;max-width:660px;line-height:1.7}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin:65px 0 42px}.tiles article{min-height:280px;padding:30px;border-radius:22px;border:1px solid #ffffff18;background:linear-gradient(155deg,#2b1720,#111113);display:flex;flex-direction:column;justify-content:flex-end}.tiles span{color:#db607a;font-size:12px;margin-bottom:auto}.tiles h2{font:700 28px 'Playfair Display',serif}.tiles p{color:#918a84;line-height:1.5}@media(max-width:750px){.tiles{grid-template-columns:1fr}}</style>
