import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import LoginView from './views/LoginView.vue'
import ResetPasswordView from './views/ResetPasswordView.vue'
import SettingsView from './views/SettingsView.vue'
import AdminView from './views/AdminView.vue'
import ChallengesView from './views/ChallengesView.vue'
import NotificationsView from './views/NotificationsView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import PayoutsView from './views/PayoutsView.vue'
import HistoryView from './views/HistoryView.vue'
import PropFirmCompareView from './views/PropFirmCompareView.vue'
import { supabase } from './lib/supabase'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/reset-password', component: ResetPasswordView, meta: { public: true } },
    { path: '/', component: ChallengesView },
    { path: '/notifications', component: NotificationsView },
    { path: '/analytics', component: AnalyticsView },
    { path: '/payouts', component: PayoutsView },
    { path: '/history', component: HistoryView },
    { path: '/compare', component: PropFirmCompareView },
    { path: '/settings', component: SettingsView },
    { path: '/admin', component: AdminView, meta: { adminOnly: true } },
  ],
})

// Auth guard — every protected route requires an active session
// Admin routes also verify server-side admin status
router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const { data } = await supabase.auth.getSession()
  if (!data.session) return '/login'

  if (to.meta.adminOnly) {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) return '/'
  }

  return true
})

createApp(App).use(router).mount('#app')
