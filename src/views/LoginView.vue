<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'

const { signIn, signUp } = useAuth()
const router = useRouter()

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>('login')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const info = ref('')

async function submit() {
  error.value = ''
  info.value = ''

  if (mode.value === 'forgot') {
    if (!email.value) { error.value = 'Email required'; return }
    loading.value = true
    try {
      const redirectTo = window.location.origin + import.meta.env.BASE_URL + 'reset-password'
      const { error: e } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo })
      if (e) throw e
      info.value = 'Check your email for a password reset link.'
    } catch (e: any) {
      error.value = e.message ?? 'Something went wrong'
    } finally {
      loading.value = false
    }
    return
  }

  if (!email.value || !password.value) {
    error.value = 'Email and password required'
    return
  }

  if (mode.value === 'register') {
    if (password.value.length < 8) {
      error.value = 'Password must be at least 8 characters'
      return
    }
    if (password.value !== confirm.value) {
      error.value = 'Passwords do not match'
      return
    }
  }

  loading.value = true
  try {
    if (mode.value === 'login') {
      await signIn(email.value, password.value)
      router.replace('/')
    } else {
      await signUp(email.value, password.value)
      info.value = 'Check your email to confirm your account.'
    }
  } catch (e: any) {
    error.value = e.message ?? 'Something went wrong'
  } finally {
    loading.value = false
  }
}

function switchMode(m: Mode) {
  mode.value = m
  error.value = ''
  info.value = ''
}
</script>

<template>
  <div class="login-shell">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
          <polygon points="20,4 36,13 36,27 20,36 4,27 4,13" stroke="var(--accent)" stroke-width="1.5" fill="none" opacity="0.3"/>
          <polygon points="20,10 30,15.5 30,24.5 20,30 10,24.5 10,15.5" stroke="var(--accent)" stroke-width="1.5" fill="none" opacity="0.6"/>
          <polygon points="20,16 24,18.5 24,21.5 20,24 16,21.5 16,18.5" fill="var(--accent)"/>
        </svg>
        <span class="login-brand">CHALLENGE TRACKER</span>
      </div>

      <!-- Mode tabs — hidden in forgot mode -->
      <div v-if="mode !== 'forgot'" class="mode-tabs">
        <button :class="['tab', mode === 'login' ? 'tab-active' : '']" @click="switchMode('login')">Sign In</button>
        <button :class="['tab', mode === 'register' ? 'tab-active' : '']" @click="switchMode('register')">Register</button>
      </div>

      <!-- Forgot password panel -->
      <div v-if="mode === 'forgot'" class="forgot-panel">
        <button type="button" class="forgot-back" @click="switchMode('login')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to sign in
        </button>
        <div class="forgot-info">
          <div class="forgot-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div class="forgot-title">Reset Password</div>
            <div class="forgot-sub">Enter your email and we'll send a reset link.</div>
          </div>
        </div>
      </div>

      <!-- Form -->
      <form class="login-form" @submit.prevent="submit">

        <div class="field">
          <label class="field-label">EMAIL</label>
          <input
            v-model="email"
            type="email"
            class="field-input"
            placeholder="trader@example.com"
            autocomplete="email"
            required
          />
        </div>

        <div v-if="mode !== 'forgot'" class="field">
          <label class="field-label">PASSWORD</label>
          <input
            v-model="password"
            type="password"
            class="field-input"
            :placeholder="mode === 'register' ? 'Min. 8 characters' : '••••••••'"
            autocomplete="current-password"
            required
          />
        </div>

        <div v-if="mode === 'register'" class="field">
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
          <span>{{ mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link' }}</span>
        </button>

        <button v-if="mode === 'login'" type="button" class="forgot-link" @click="switchMode('forgot')">
          Forgot password?
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}

.login-card {
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

.login-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login-brand {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-secondary);
}

.mode-tabs {
  display: flex;
  gap: 2px;
  background: var(--bg);
  border-radius: 8px;
  padding: 3px;
}

.tab {
  flex: 1;
  padding: 7px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.tab-active {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.login-form {
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

.field-input:focus {
  border-color: var(--accent);
}

.field-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

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

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn:not(:disabled):hover { opacity: 0.88; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #0f1115;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.forgot-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  text-align: center;
  padding: 0;
  transition: color 0.15s;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: color 0.15s, text-decoration-color 0.15s;
}

.forgot-link:hover {
  color: var(--text-secondary);
  text-decoration-color: var(--text-muted);
}

/* ── Forgot panel ── */
.forgot-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.forgot-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  align-self: flex-start;
}

.forgot-back:hover {
  color: var(--text-secondary);
  border-color: var(--text-muted);
}

.forgot-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(240, 180, 41, 0.05);
  border: 1px solid rgba(240, 180, 41, 0.15);
  border-radius: 8px;
}

.forgot-icon {
  width: 40px;
  height: 40px;
  background: rgba(240, 180, 41, 0.08);
  border: 1px solid rgba(240, 180, 41, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.forgot-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 2px;
}

.forgot-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}
</style>
