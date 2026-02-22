<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'

const { user } = useAuth()

const open      = ref(false)
const category  = ref<'bug' | 'feature' | 'general'>('general')
const message   = ref('')
const submitting = ref(false)
const done      = ref(false)
const error     = ref('')

function show() {
  open.value = true
  done.value = false
  error.value = ''
  message.value = ''
  category.value = 'general'
}

function hide() {
  open.value = false
}

async function submit() {
  if (!message.value.trim()) return
  submitting.value = true
  error.value = ''
  try {
    const { error: e } = await supabase.from('feedback').insert({
      user_id: user.value?.id ?? null,
      email: user.value?.email ?? null,
      message: message.value.trim(),
      category: category.value,
    })
    if (e) throw e
    done.value = true
    message.value = ''
  } catch (e: any) {
    error.value = e.message ?? 'Something went wrong'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Trigger button -->
  <button class="fb-trigger" @click="show" title="Send feedback">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  </button>

  <!-- Modal -->
  <Teleport to="body">
    <Transition name="fb-fade">
      <div v-if="open" class="fb-veil" @click.self="hide">
        <div class="fb-box">

          <div class="fb-header">
            <div class="fb-header-left">
              <div class="fb-eyebrow">FEEDBACK</div>
              <div class="fb-title">Send a message</div>
            </div>
            <button class="fb-close" @click="hide">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <template v-if="!done">
            <div class="fb-body">
              <div class="fb-field">
                <div class="fb-label">TYPE</div>
                <div class="fb-cats">
                  <button
                    v-for="c in [
                      { key: 'bug',     label: '🐛 Bug' },
                      { key: 'feature', label: '💡 Feature' },
                      { key: 'general', label: '💬 General' },
                    ]"
                    :key="c.key"
                    type="button"
                    class="fb-cat"
                    :class="{ active: category === c.key }"
                    @click="category = c.key as any"
                  >{{ c.label }}</button>
                </div>
              </div>
              <div class="fb-field">
                <div class="fb-label">MESSAGE</div>
                <textarea
                  v-model="message"
                  class="fb-textarea"
                  rows="4"
                  placeholder="What's on your mind?"
                  maxlength="2000"
                />
                <div class="fb-char">{{ message.length }} / 2000</div>
              </div>
              <div v-if="error" class="fb-error">{{ error }}</div>
            </div>
            <div class="fb-footer">
              <button class="fb-cancel" @click="hide">Cancel</button>
              <button
                class="fb-submit"
                :disabled="submitting || !message.trim()"
                @click="submit"
              >
                <span v-if="submitting" class="fb-spinner" />
                {{ submitting ? 'Sending…' : 'Send Feedback' }}
              </button>
            </div>
          </template>

          <div v-else class="fb-done">
            <div class="fb-done-icon">✓</div>
            <div class="fb-done-title">Feedback sent</div>
            <div class="fb-done-sub">Thanks — I'll take a look shortly.</div>
            <button class="fb-submit" @click="hide">Close</button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Trigger */
.fb-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: var(--radius-sm, 6px);
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.fb-trigger:hover {
  color: var(--accent);
  background: var(--surface);
}

/* Veil */
.fb-veil {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.fb-fade-enter-active, .fb-fade-leave-active { transition: opacity 0.18s; }
.fb-fade-enter-from, .fb-fade-leave-to { opacity: 0; }

/* Box */
.fb-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  overflow: hidden;
}

/* Header */
.fb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 14px;
  border-bottom: 1px solid var(--border);
}

.fb-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--accent);
  margin-bottom: 3px;
}

.fb-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.fb-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.fb-close:hover { border-color: var(--red, #ef4444); color: var(--red, #ef4444); }

/* Body */
.fb-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fb-field { display: flex; flex-direction: column; gap: 7px; }

.fb-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-muted);
}

.fb-cats { display: flex; gap: 6px; }

.fb-cat {
  flex: 1;
  padding: 7px 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.fb-cat:hover { border-color: var(--accent); color: var(--text-secondary); }
.fb-cat.active {
  background: rgba(240,180,41,0.1);
  border-color: rgba(240,180,41,0.4);
  color: var(--accent);
}

.fb-textarea {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 10px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-primary);
  resize: vertical;
  min-height: 90px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.fb-textarea:focus { border-color: var(--accent); }
.fb-textarea::placeholder { color: var(--text-muted); opacity: 0.5; }

.fb-char {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
  opacity: 0.6;
}

.fb-error {
  padding: 8px 12px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #ef4444;
}

/* Footer */
.fb-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}

.fb-cancel {
  padding: 7px 14px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.15s;
}

.fb-cancel:hover { border-color: var(--text-muted); }

.fb-submit {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #0a0b0f;
  cursor: pointer;
  transition: opacity 0.15s;
}

.fb-submit:disabled { opacity: 0.45; cursor: not-allowed; }
.fb-submit:not(:disabled):hover { opacity: 0.88; }

.fb-spinner {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #0a0b0f;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Done state */
.fb-done {
  padding: 32px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.fb-done-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.3);
  color: var(--green, #22c55e);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.fb-done-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.fb-done-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
</style>
