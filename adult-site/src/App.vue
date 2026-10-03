<template>
  <header class="site-header">
    <RouterLink class="brand" to="/">Veil<span>18</span></RouterLink>
    <nav aria-label="Primary navigation">
      <RouterLink to="/">About</RouterLink>
      <RouterLink to="/adult">Members area</RouterLink>
    </nav>
  </header>
  <main><RouterView /></main>
  <footer>Proof of concept · No adult material · No identity tracking</footer>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
:root { color: #f7f3eb; background: #09090b; font-family: 'DM Sans', sans-serif; font-synthesis: none; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 80% 10%, #3f1626 0, transparent 32rem), #09090b; }
a { color: inherit; }
button { font: inherit; }
.site-header { height: 76px; padding: 0 clamp(24px, 6vw, 96px); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ffffff18; }
.brand { font: 700 27px 'Playfair Display', serif; text-decoration: none; letter-spacing: -.5px; }
.brand span { color: #e35d78; }
nav { display: flex; gap: 28px; }
nav a { color: #c8c3bc; text-decoration: none; font-size: 14px; }
nav a.router-link-active { color: white; }
main { min-height: calc(100vh - 136px); }
footer { color: #79746f; border-top: 1px solid #ffffff12; padding: 20px clamp(24px, 6vw, 96px); font-size: 12px; }
.button { border: 0; border-radius: 999px; padding: 14px 22px; color: white; background: #d94264; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 9px; }
.button:hover { background: #ec5575; }
.button.secondary { background: transparent; border: 1px solid #ffffff30; }
.eyebrow { color: #e7768e; letter-spacing: .18em; text-transform: uppercase; font-size: 12px; font-weight: 700; }
@media (max-width: 600px) { nav a:first-child { display: none; } .site-header { height: 64px; } }
</style>
