import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '@/views/LandingView.vue'
import VerifyView from '@/views/VerifyView.vue'
import AdultView from '@/views/AdultView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: LandingView },
    { path: '/verify', component: VerifyView },
    { path: '/adult', component: AdultView, meta: { requiresAccess: true } },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAccess) return true
  try {
    const response = await fetch('/api/access', { credentials: 'same-origin' })
    const body = (await response.json()) as { allowed?: boolean }
    return body.allowed === true ? true : { path: '/verify', query: { reason: 'required' } }
  } catch {
    return { path: '/verify', query: { reason: 'service' } }
  }
})

export default router
