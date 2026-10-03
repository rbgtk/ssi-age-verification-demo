<template>
  <section class="hero">
    <div class="copy">
      <p class="eyebrow">Private by design</p>
      <h1>Prove your age.<br><em>Keep your identity.</em></h1>
      <p class="lede">Enter an adults-only demo without sending us your name, birthday, ID card, or payment details. Your wallet shares one answer: whether you are over 18.</p>
      <div class="actions">
        <RouterLink class="button" to="/verify">Verify privately <span>→</span></RouterLink>
        <a class="learn" href="#how">How it works</a>
      </div>
    </div>
    <div class="proof-card" aria-label="Privacy summary">
      <div class="halo"><span>18+</span></div>
      <p class="verified">Zero-knowledge mindset</p>
      <p>Your exact age stays in your wallet.</p>
      <div class="facts">
        <span>Not shared</span><strong>Name · birth date · document</strong>
        <span>Shared</span><strong>Over 18: yes or no</strong>
      </div>
    </div>
  </section>
  <section id="how" class="how">
    <p class="eyebrow">Minimal disclosure</p>
    <h2>One fact. Nothing more.</h2>
    <div class="steps">
      <article><b>01</b><h3>Open your wallet</h3><p>Sign in as Alice or Bob and review the verifier request.</p></article>
      <article><b>02</b><h3>Choose to share</h3><p>Your wallet presents only the selectively disclosed 18+ claim.</p></article>
      <article><b>03</b><h3>Enter—or don’t</h3><p>A verified true result unlocks this browser session. No profile is created.</p></article>
    </div>
  </section>
</template>

<style scoped>
.hero { max-width: 1220px; margin: auto; padding: 90px 32px 110px; display: grid; grid-template-columns: 1.25fr .75fr; gap: 70px; align-items: center; }
h1 { font: 700 clamp(52px, 7vw, 92px)/.98 'Playfair Display', serif; letter-spacing: -.045em; margin: 16px 0 28px; }
h1 em { color: #d94264; }
.lede { color: #aaa49c; font-size: 18px; line-height: 1.7; max-width: 650px; }
.actions { display: flex; gap: 25px; align-items: center; margin-top: 36px; }
.learn { color: #d0cac2; text-underline-offset: 5px; }
.proof-card { background: linear-gradient(145deg, #201b1d, #111113); border: 1px solid #ffffff1a; border-radius: 28px; padding: 38px; text-align: center; box-shadow: 0 30px 90px #0008; }
.halo { width: 142px; height: 142px; margin: 0 auto 26px; border-radius: 50%; display: grid; place-items: center; background: #d9426417; border: 1px solid #e55a7770; box-shadow: 0 0 50px #d9426438; }
.halo span { font: 700 50px 'Playfair Display', serif; }
.verified { color: #f0a0b1; font-weight: 700; }
.proof-card > p:last-of-type { color: #87817a; }
.facts { margin-top: 30px; border-top: 1px solid #ffffff17; padding-top: 22px; display: grid; grid-template-columns: auto 1fr; gap: 12px 16px; text-align: left; font-size: 12px; }
.facts span { color: #77716b; }.facts strong { font-weight: 500; }
.how { background: #f3eee5; color: #171315; padding: 90px max(32px, calc((100vw - 1156px)/2)); }
.how h2 { font: 700 48px 'Playfair Display', serif; margin: 12px 0 55px; }.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 45px; }.steps b { color: #c63355; }.steps h3 { margin-top: 28px; }.steps p { color: #69625d; line-height: 1.65; }
@media(max-width:800px){.hero{grid-template-columns:1fr;padding-top:60px}.proof-card{max-width:480px}.steps{grid-template-columns:1fr}.how{padding:70px 32px}}
</style>
