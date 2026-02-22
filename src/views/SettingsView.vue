<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useTour } from '@/composables/useTour'
import { useStartPage } from '@/composables/useStartPage'
import { supabase } from '@/lib/supabase'

const { user, signOut } = useAuth()
const router = useRouter()
const toast = useToast()
const { startTour } = useTour()
const { startPage, setStartPage, START_PAGE_OPTIONS } = useStartPage()

const apiKey = ref('')
const hasKey = ref(false)
const saving = ref(false)
const removing = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

onMounted(async () => {
  const { data } = await supabase.rpc('has_metacopier_key')
  hasKey.value = !!data
})

async function saveApiKey() {
  saveError.value = ''
  saveSuccess.value = false

  if (!apiKey.value.trim()) {
    saveError.value = 'API key cannot be empty'
    return
  }

  saving.value = true
  try {
    const { error: fnError } = await supabase.functions.invoke('save-api-key', {
      body: { api_key: apiKey.value },
    })

    if (fnError) throw new Error(fnError.message ?? 'Failed to save')

    hasKey.value = true
    saveSuccess.value = true
    apiKey.value = ''
    toast.success('API key saved — accounts will sync shortly')
  } catch (e: any) {
    saveError.value = e.message ?? 'Something went wrong'
    toast.error(saveError.value)
  } finally {
    saving.value = false
  }
}

async function removeApiKey() {
  if (!confirm('Remove your MetaCopier API key? The app will stop syncing until you add a new one.')) return
  removing.value = true
  try {
    const { error } = await supabase.rpc('delete_metacopier_key')
    if (error) throw error
    hasKey.value = false
    saveSuccess.value = false
    toast.success('API key removed')
  } catch (e: any) {
    toast.error(e.message ?? 'Failed to remove key')
  } finally {
    removing.value = false
  }
}

async function handleSignOut() {
  await signOut()
  router.replace('/login')
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-inner">
      <div class="page-header">
        <span class="page-tag">▸ SETTINGS</span>
        <h1 class="page-title">Account Settings</h1>
      </div>

      <!-- User info -->
      <section class="settings-card">
        <div class="card-label">ACCOUNT</div>
        <div class="user-row">
          <div class="user-email">{{ user?.email }}</div>
          <button class="danger-btn" @click="handleSignOut">Sign Out</button>
        </div>
      </section>

      <!-- Guide -->
      <section class="settings-card">
        <div class="card-label">APP GUIDE</div>
        <p class="card-desc">Take an interactive tour of Challenge Tracker — highlights each feature with a short explanation.</p>
        <div class="card-actions">
          <button class="ghost-btn" @click="startTour">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="flex-shrink:0">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            Start Guide
          </button>
        </div>
      </section>

      <!-- Start Page -->
      <section class="settings-card">
        <div class="card-label">START PAGE</div>
        <p class="card-desc">Choose which page opens when you launch the app.</p>
        <div class="start-page-options">
          <button
            v-for="opt in START_PAGE_OPTIONS"
            :key="opt.path"
            class="start-page-btn"
            :class="{ active: startPage === opt.path }"
            @click="setStartPage(opt.path)"
          >
            <span class="sp-dot" />
            {{ opt.label }}
          </button>
        </div>
      </section>

      <!-- API Key -->
      <section class="settings-card">
        <div class="card-label">METACOPIER API KEY</div>
        <div class="key-status">
          <span v-if="hasKey" class="status-badge status-ok">● Key configured</span>
          <span v-else class="status-badge status-warn">● No key set — required to use the app</span>
          <button v-if="hasKey" class="remove-key-btn" :disabled="removing" @click="removeApiKey">
            <span v-if="removing" class="spinner spinner-red" />
            {{ removing ? 'Removing…' : 'Remove Key' }}
          </button>
        </div>
        <p class="card-desc">
          Your key is encrypted and stored server-side. It is never sent to your browser after saving.
          Enter a new key below to update it.
        </p>
        <form class="field" @submit.prevent="saveApiKey">
          <input type="text" name="username" autocomplete="username" style="display:none" />
          <input
            v-model="apiKey"
            type="password"
            class="field-input"
            placeholder="Paste your MetaCopier API key…"
            autocomplete="new-password"
          />
        </form>
        <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
        <div v-if="saveSuccess" class="alert alert-ok">API key saved successfully.</div>
        <div class="card-actions">
          <button class="save-btn" :disabled="saving || !apiKey" @click="saveApiKey">
            <span v-if="saving" class="spinner" />
            {{ saving ? 'Validating…' : 'Save Key' }}
          </button>
          <button v-if="hasKey" class="ghost-btn" @click="router.replace('/dashboard')">
            Go to Dashboard
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 16px 64px;
}

.settings-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--accent);
  opacity: 0.8;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.settings-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.user-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text-primary);
}

.key-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.remove-key-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #ef4444;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.remove-key-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

.remove-key-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner-red {
  border-color: rgba(239, 68, 68, 0.2);
  border-top-color: #ef4444;
}

.status-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
}

.status-ok  { color: var(--green, #22c55e); }
.status-warn { color: var(--accent); }

.card-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0;
}

.field { display: flex; flex-direction: column; gap: 6px; }

.field-input {
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}

.field-input:focus { border-color: var(--accent); }

.alert {
  padding: 10px 14px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.alert-ok {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: var(--green, #22c55e);
}

.card-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.save-btn {
  padding: 10px 20px;
  background: var(--accent);
  color: #0f1115;
  border: none;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.15s;
}

.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.save-btn:not(:disabled):hover { opacity: 0.88; }

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.ghost-btn:hover { border-color: var(--accent); color: var(--accent); }

.danger-btn {
  padding: 7px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 7px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: #ef4444;
  cursor: pointer;
  transition: background 0.15s;
}

.danger-btn:hover { background: rgba(239, 68, 68, 0.2); }

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #0f1115;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.start-page-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.start-page-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.start-page-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.start-page-btn.active {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.08);
  color: var(--accent);
}

.sp-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  flex-shrink: 0;
  transition: background 0.15s;
}

.start-page-btn.active .sp-dot {
  background: var(--accent);
  border-color: var(--accent);
}
</style>
