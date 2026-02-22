<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotifications } from '@/composables/useNotifications'
import { useAuth } from '@/composables/useAuth'
import { useAdmin } from '@/composables/useAdmin'
import { useMasterToggle } from '@/composables/useMasterToggle'
import FeedbackModal from '@/components/FeedbackModal.vue'

const route = useRoute()
const router = useRouter()
const { unreadCount } = useNotifications()
const { user, signOut } = useAuth()
const { isAdmin, checkAdmin, resetAdmin } = useAdmin()
const { includeMaster } = useMasterToggle()
const mobileOpen = ref(false)

checkAdmin()

const navItems = [
  { path: '/', label: 'Challenges', tour: '' },
  { path: '/notifications', label: 'Notifications', tour: 'nav-notifications' },
  { path: '/analytics', label: 'Analytics', tour: 'nav-analytics' },
  { path: '/payouts', label: 'Payouts', tour: 'nav-payouts' },
  { path: '/history', label: 'History', tour: '' },
  { path: '/compare', label: 'Compare Prop Firms', tour: 'nav-compare' },
]

async function handleSignOut() {
  resetAdmin()
  await signOut()
  router.replace('/login')
}
</script>

<template>
  <nav class="navbar">
    <div class="navbar-inner">
      <div class="navbar-brand">
        <div class="brand-mark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L18 7V13L10 18L2 13V7L10 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M10 7L14 9.5V14.5L10 17L6 14.5V9.5L10 7Z" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <span class="brand-text">CHALLENGE<span class="brand-accent">TRACKER</span></span>
      </div>

      <div class="navbar-links" :class="{ open: mobileOpen }">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: route.path === item.path }"
          :data-tour="item.tour || undefined"
          @click="mobileOpen = false"
        >
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-indicator" />
          <span
            v-if="item.path === '/notifications' && unreadCount > 0"
            class="badge"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </router-link>
      </div>

      <div class="navbar-right">
        <div class="live-indicator">
          <span class="live-dot" />
          <span class="live-text">LIVE</span>
        </div>
        <button
          class="master-toggle"
          :class="{ active: includeMaster }"
          @click="includeMaster = !includeMaster"
          :title="includeMaster ? 'Master data included — click to exclude' : 'Click to include master account data'"
        >
          <span class="master-toggle-dot" />
          <span class="master-toggle-label">{{ includeMaster ? 'MASTER ON' : 'MASTER OFF' }}</span>
        </button>
        <FeedbackModal />
        <router-link v-if="isAdmin" to="/admin" class="settings-btn admin-link" title="Admin">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1.5" y="5.5" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="7.5" cy="9.5" r="1" fill="currentColor"/>
          </svg>
        </router-link>
        <router-link to="/settings" class="settings-btn" title="Settings">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M6.07 1.5a.5.5 0 00-.49.4l-.2 1.02a4.5 4.5 0 00-.9.52l-.98-.33a.5.5 0 00-.59.23L1.91 4.66a.5.5 0 00.1.63l.79.67a4.6 4.6 0 000 1.08l-.79.67a.5.5 0 00-.1.63l1.03 1.78a.5.5 0 00.59.23l.97-.33c.29.2.59.38.91.52l.2 1.02a.5.5 0 00.49.4h2.06a.5.5 0 00.49-.4l.2-1.02c.32-.14.62-.32.91-.52l.97.33a.5.5 0 00.59-.23l1.03-1.78a.5.5 0 00-.1-.63l-.79-.67c.02-.18.03-.36.03-.54s-.01-.36-.03-.54l.79-.67a.5.5 0 00.1-.63L11.1 3.34a.5.5 0 00-.59-.23l-.98.33a4.5 4.5 0 00-.9-.52l-.2-1.02a.5.5 0 00-.49-.4H6.07z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
            <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" stroke-width="1.1"/>
          </svg>
        </router-link>
        <button class="signout-btn" @click="handleSignOut" title="Sign out">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="hamburger" @click="mobileOpen = !mobileOpen" :class="{ open: mobileOpen }">
          <span /><span /><span />
        </button>
      </div>
    </div>
    <div class="navbar-border" />
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-elevated);
  backdrop-filter: blur(12px);
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  height: 52px;
}

.navbar-border {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 20%, var(--accent) 80%, transparent 100%);
  opacity: 0.15;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  color: var(--accent);
  display: flex;
  align-items: center;
}

.brand-text {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

.brand-accent {
  color: var(--accent);
}

.navbar-links {
  display: flex;
  gap: 2px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 18px;
  color: var(--text-tertiary);
  text-decoration: none;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: color 0.2s var(--ease-out);
}

.nav-link:hover {
  color: var(--text-secondary);
}

.nav-link.active {
  color: var(--text-primary);
}

.nav-indicator {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 24px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  transition: transform 0.25s var(--ease-out);
}

.nav-link.active .nav-indicator {
  transform: translateX(-50%) scaleX(1);
}

.badge {
  position: absolute;
  top: 0;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
}

.settings-btn:hover,
.settings-btn.router-link-active {
  color: var(--accent);
  background: var(--surface);
}

.admin-link.router-link-active { color: #ef4444; }

.master-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.master-toggle:hover {
  border-color: var(--accent);
}

.master-toggle.active {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.1);
}

.master-toggle-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: background 0.15s;
  flex-shrink: 0;
}

.master-toggle.active .master-toggle-dot {
  background: var(--accent);
}

.master-toggle-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  transition: color 0.15s;
}

.master-toggle.active .master-toggle-label {
  color: var(--accent);
}

@media (max-width: 640px) {
  .master-toggle-label {
    display: none;
  }
}

.signout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.signout-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-live 2s ease-in-out infinite;
}

.live-text {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--green);
}

/* ─── Hamburger ─── */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 7px;
  margin-left: 8px;
}

.hamburger span {
  display: block;
  height: 1.5px;
  background: var(--text-secondary);
  border-radius: 1px;
  transition: transform 0.2s, opacity 0.2s;
}

.hamburger.open span:nth-child(1) {
  transform: translateY(5.5px) rotate(45deg);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: translateY(-5.5px) rotate(-45deg);
}

@media (max-width: 640px) {
  .navbar-inner {
    padding: 0 16px;
  }

  .brand-text {
    font-size: 11px;
  }

  .hamburger {
    display: flex;
  }

  .navbar-links {
    display: none;
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    flex-direction: column;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    gap: 0;
    z-index: 99;
  }

  .navbar-links.open {
    display: flex;
  }

  .nav-link {
    padding: 12px 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .nav-link:last-child {
    border-bottom: none;
  }

  .nav-indicator {
    display: none;
  }

  .nav-link.active {
    color: var(--accent);
  }

  .live-indicator {
    padding: 3px 8px;
  }
}
</style>
