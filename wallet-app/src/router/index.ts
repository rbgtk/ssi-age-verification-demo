import { createRouter, createWebHistory } from 'vue-router'
import AuthView from '@/views/AuthView.vue'
import WalletView from '@/views/WalletView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/wallet' },
    { path: '/auth', component: AuthView },
    { path: '/wallet', component: WalletView },
    { path: '/api/siop/initiatePresentation', component: WalletView },
  ],
})

export default router
