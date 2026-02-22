<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ToastContainer from './components/ToastContainer.vue'
import ApiKeyBanner from './components/ApiKeyBanner.vue'
import { useMetaCopier } from '@/composables/useMetaCopier'
import { useChallenges } from '@/composables/useChallenges'
import { useNotifications } from '@/composables/useNotifications'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'

const { startAutoRefresh } = useMetaCopier()
const { fetchChallenges, challengeRows } = useChallenges()
const { startPolling } = useNotifications()
const { isAuthenticated } = useAuth()
const router = useRouter()
const route = useRoute()

const appReady = ref(false)

async function bootstrap() {
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

// Re-bootstrap when user logs in
watch(isAuthenticated, async (authed) => {
  if (authed && !appReady.value) {
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
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <polygon points="20,4 36,13 36,27 20,36 4,27 4,13" stroke="var(--accent)" stroke-width="1.5" fill="none" opacity="0.3"/>
              <polygon points="20,10 30,15.5 30,24.5 20,30 10,24.5 10,15.5" stroke="var(--accent)" stroke-width="1.5" fill="none" opacity="0.6"/>
              <polygon points="20,16 24,18.5 24,21.5 20,24 16,21.5 16,18.5" fill="var(--accent)"/>
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
