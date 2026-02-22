<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const info = ref('')
const ready = ref(false)

// Supabase embeds the access token in the URL hash after redirect
// We need to wait for the auth state change that processes the hash
onMounted(() => {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      ready.value = true
    }
  })

  // If no PASSWORD_RECOVERY event fires within 2s, show an error
  setTimeout(() => {
    if (!ready.value) {
      error.value = 'Invalid or expired reset link. Please request a new one.'
    }
  }, 2000)
})

async function submit() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true
  try {
    const { error: e } = await supabase.auth.updateUser({ password: password.value })
    if (e) throw e
    info.value = 'Password updated! Redirecting...'
    setTimeout(() => router.replace('/'), 1500)
  } catch (e: any) {
    error.value = e.message ?? 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="reset-shell">
    <div class="reset-card">
      <!-- Logo -->
      <div class="reset-logo">
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <polygon points="20,4 36,13 36,27 20,36 4,27 4,13" stroke="var(--accent)" stroke-width="1.5" fill="none" opacity="0.3"/>
          <polygon points="20,10 30,15.5 30,24.5 20,30 10,24.5 10,15.5" stroke="var(--accent)" stroke-width="1.5" fill="none" opacity="0.6"/>
          <polygon points="20,16 24,18.5 24,21.5 20,24 16,21.5 16,18.5" fill="var(--accent)"/>
        </svg>
        <span class="reset-brand">CHALLENGE TRACKER</span>
      </div>

      <div class="reset-heading">
        <p class="reset-title">Set New Password</p>
        <p class="reset-sub">Choose a strong password for your account.</p>
      </div>

      <!-- Loading state while waiting for token -->
      <div v-if="!ready && !error" class="reset-waiting">
        <span class="spinner-dark" />
        <span>Verifying reset link...</span>
      </div>

      <!-- Error (invalid link) -->
      <div v-else-if="error && !ready" class="alert alert-error">{{ error }}</div>

      <!-- Form -->
      <form v-else class="reset-form" @submit.prevent="submit">
        <div class="field">
          <label class="field-label">NEW PASSWORD</label>
          <input
            v-model="password"
            type="password"
            class="field-input"
            placeholder="Min. 8 characters"
            autocomplete="new-password"
            required
          />
        </div>

        <div class="field">
          <label class="field-label">CONFIRM PASSWORD</label>
          <input
            v-model="confirm"
            type="password"
            class="field-input"
            placeholder="••••••••"
            autocomplete="new-password"
          />
        </div>

        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div v-if="info" class="alert alert-info">{{ info }}</div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span>Update Password</span>
        </button>

        <button type="button" class="back-link" @click="router.replace('/login')">
          ← Back to sign in
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.reset-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}

.reset-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg, 12px);
  padding: 36px 32px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.reset-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reset-brand {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-secondary);
}

.reset-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reset-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.reset-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}

.reset-waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-muted);
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

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
.field-input::placeholder { color: var(--text-muted); opacity: 0.5; }

.alert {
  padding: 10px 14px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.alert-info {
  background: rgba(var(--accent-rgb, 240, 180, 41), 0.1);
  border: 1px solid rgba(var(--accent-rgb, 240, 180, 41), 0.3);
  color: var(--accent);
}

.submit-btn {
  margin-top: 4px;
  padding: 12px;
  background: var(--accent);
  color: #0f1115;
  border: none;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity 0.15s;
}

.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.submit-btn:not(:disabled):hover { opacity: 0.88; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #0f1115;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-dark {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.back-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  text-align: center;
  transition: color 0.15s;
  padding: 0;
}
.back-link:hover { color: var(--text-secondary); }
</style>
