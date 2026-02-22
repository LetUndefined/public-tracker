import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import LoginView from './views/LoginView.vue'
import LandingView from './views/LandingView.vue'
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
    { path: '/',               component: LandingView,        meta: { public: true } },
    { path: '/login',          component: LoginView,          meta: { public: true } },
    { path: '/reset-password', component: ResetPasswordView,  meta: { public: true } },
    { path: '/dashboard',      component: ChallengesView },
    { path: '/notifications',  component: NotificationsView },
    { path: '/analytics',      component: AnalyticsView },
    { path: '/payouts',        component: PayoutsView },
    { path: '/history',        component: HistoryView },
    { path: '/compare',        component: PropFirmCompareView },
    { path: '/settings',       component: SettingsView },
    { path: '/admin',          component: AdminView,          meta: { adminOnly: true } },
  ],
})

// Auth guard
router.beforeEach(async (to) => {
  if (to.meta.public) {
    // Redirect authenticated users away from landing/login to dashboard
    if (to.path === '/' || to.path === '/login') {
      const { data } = await supabase.auth.getSession()
      if (data.session) return '/dashboard'
    }
    return true
  }

  const { data } = await supabase.auth.getSession()
  if (!data.session) return '/login'

  if (to.meta.adminOnly) {
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) return '/dashboard'
  }

  return true
})

createApp(App).use(router).mount('#app')
