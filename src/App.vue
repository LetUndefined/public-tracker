<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ToastContainer from './components/ToastContainer.vue'
import ApiKeyBanner from './components/ApiKeyBanner.vue'
import TourOverlay from './components/TourOverlay.vue'
import PageTip from './components/PageTip.vue'
import { useMetaCopier } from '@/composables/useMetaCopier'
import { useChallenges } from '@/composables/useChallenges'
import { useNotifications } from '@/composables/useNotifications'
import { useAuth } from '@/composables/useAuth'
import { useTour } from '@/composables/useTour'
import { supabase } from '@/lib/supabase'

const { startAutoRefresh } = useMetaCopier()
const { fetchChallenges, challengeRows } = useChallenges()
const { startPolling } = useNotifications()
const { isAuthenticated } = useAuth()
const { startTour, hasSeenTour } = useTour()
const router = useRouter()
const route = useRoute()

const appReady = ref(false)
let bootstrapped = false

async function bootstrap() {
  bootstrapped = true
  startAutoRefresh(30_000)
  await fetchChallenges()

  if (challengeRows.value.length > 0) {
    startPolling(15_000)
  } else {
    const unwatch = watch(
      () => challengeRows.value.length,
      (len) => {
        if (len > 0) {
          unwatch()
          startPolling(15_000)
        }
      }
    )
  }

  appReady.value = true

  // Auto-launch tour for first-time users
  if (!hasSeenTour()) {
    setTimeout(startTour, 600)
  }
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    appReady.value = true // show login page immediately
    return
  }

  // Check if user has configured their API key
  const { data: hasKey } = await supabase.rpc('has_metacopier_key')
  if (!hasKey && route.path !== '/settings') {
    appReady.value = true
    router.replace('/settings')
    return
  }

  await bootstrap()
})

// Bootstrap after sign-in (appReady was already true for the login page,
// so we track bootstrapped separately)
watch(isAuthenticated, async (authed) => {
  if (authed && !bootstrapped) {
    await bootstrap()
  }
})
</script>

<template>
  <div class="app-shell">
    <Transition name="loader-fade">
      <div v-if="!appReady" class="boot-screen">
        <div class="boot-inner">
          <div class="boot-logo">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10.3" stroke="var(--accent)" stroke-width="1.2"/>
              <line x1="12" y1="1.7" x2="12" y2="5"   stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="22.3" y1="12" x2="19" y2="12" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="12" y1="22.3" x2="12" y2="19" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
              <line x1="1.7" y1="12" x2="5" y2="12"   stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="4.5" stroke="var(--accent)" stroke-width="0.7" stroke-opacity="0.4"/>
              <path d="M12 9.8L14.2 12L12 14.2L9.8 12Z" fill="var(--accent)"/>
            </svg>
          </div>
          <div class="boot-label">INITIALIZING</div>
          <div class="boot-bar"><div class="boot-bar-fill" /></div>
          <div class="boot-sub">Syncing accounts&hellip;</div>
        </div>
      </div>
    </Transition>

    <template v-if="appReady">
      <div class="ambient-glow" />
      <NavBar v-if="isAuthenticated" />
      <ApiKeyBanner v-if="isAuthenticated" />
      <main class="app-content">
        <router-view />
      </main>
    </template>
  </div>
  <ToastContainer />
  <TourOverlay />
  <PageTip />
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.boot-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.boot-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.boot-logo { animation: boot-pulse 1.6s ease-in-out infinite; }

@keyframes boot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.95); }
}

.boot-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--accent);
}

.boot-bar {
  width: 160px;
  height: 2px;
  background: var(--border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.boot-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  animation: boot-progress 1.8s ease-in-out infinite;
}

@keyframes boot-progress {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(0%); }
  100% { transform: translateX(160px); }
}

.boot-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.loader-fade-leave-active { transition: opacity 0.4s ease; }
.loader-fade-leave-to { opacity: 0; }

.ambient-glow {
  position: fixed;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 240px;
  background: radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.app-content {
  flex: 1;
  position: relative;
  z-index: 1;
}
</style>
