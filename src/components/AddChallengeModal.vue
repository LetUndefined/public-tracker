<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MetaCopierAccount } from '@/types'
import { useChallenges } from '@/composables/useChallenges'
import { propFirms } from '@/lib/propFirms'

const firmSearch = ref('')
const firmDropdownOpen = ref(false)

const filteredFirms = computed(() =>
  firmSearch.value.trim()
    ? propFirms.filter(f => f.name.toLowerCase().includes(firmSearch.value.toLowerCase()))
    : propFirms
)

function selectFirm(name: string) {
  propFirm.value = name
  firmSearch.value = name
  firmDropdownOpen.value = false
}

function onFirmBlur() {
  setTimeout(() => { firmDropdownOpen.value = false }, 150)
}

function onFirmFocus() {
  firmSearch.value = ''
  firmDropdownOpen.value = true
}

const props = defineProps<{
  show: boolean
  unlinkedAccounts: MetaCopierAccount[]
}>()

const emit = defineEmits<{
  close: []
  added: []
}>()

const { addChallenge, guessProFirm, guessPlatform } = useChallenges()

const selectedAccountId = ref('')
const alias = ref('')
const propFirm = ref('')
const phase = ref<'Phase 1' | 'Phase 2' | 'Funded' | 'Master'>('Phase 1')
const targetPct = ref(8)
const owner = ref('')
const startingBalance = ref(0)
const cost = ref<number | ''>('')
const dailyDdPct = ref<number | ''>('')
const maxDdPct = ref<number | ''>('')
const startedAt = ref('')
const saving = ref(false)
const errorMsg = ref('')

const selectedAccount = computed(() =>
  props.unlinkedAccounts.find(a => a.id === selectedAccountId.value)
)

watch(selectedAccountId, (id) => {
  const acc = props.unlinkedAccounts.find(a => a.id === id)
  if (!acc) return
  alias.value = acc.name || acc.login
  startingBalance.value = acc.balance ?? 0
  const guessed = guessProFirm(acc.server)
  if (guessed !== 'Unknown') { propFirm.value = guessed; firmSearch.value = guessed }
  const firm = propFirms.find(f => f.name === propFirm.value)
  if (firm) {
    const phaseConfig = firm.phases.find(p => p.name === phase.value)
    if (phaseConfig) targetPct.value = phaseConfig.target_pct
  }
})

watch([propFirm, phase], () => {
  if (phase.value === 'Master') {
    targetPct.value = 0
    dailyDdPct.value = ''
    maxDdPct.value = ''
    return
  }
  const firm = propFirms.find(f => f.name === propFirm.value)
  if (firm) {
    const phaseConfig = firm.phases.find(p => p.name === phase.value)
    if (phaseConfig) {
      targetPct.value = phaseConfig.target_pct
      dailyDdPct.value = phaseConfig.daily_dd_pct
      maxDdPct.value = phaseConfig.max_dd_pct
    }
  }
})

async function handleSubmit() {
  if (!selectedAccountId.value) { errorMsg.value = 'Select an account'; return }
  if (!propFirm.value && phase.value !== 'Master') { errorMsg.value = 'Select a prop firm'; return }
  const acc = selectedAccount.value!
  saving.value = true
  errorMsg.value = ''
  try {
    await addChallenge({
      metacopier_account_id: acc.id,
      alias: alias.value,
      prop_firm: propFirm.value || 'Master',
      phase: phase.value,
      platform: guessPlatform(acc),
      target_pct: targetPct.value,
      owner: owner.value,
      login_number: acc.login,
      login_server: acc.server,
      starting_balance: startingBalance.value > 0 ? startingBalance.value : undefined,
      cost: cost.value !== '' ? Number(cost.value) : undefined,
      daily_dd_pct: dailyDdPct.value !== '' ? Number(dailyDdPct.value) : undefined,
      max_dd_pct: maxDdPct.value !== '' ? Number(maxDdPct.value) : undefined,
      started_at: startedAt.value ? new Date(startedAt.value).toISOString() : undefined,
    })
    emit('added')
    emit('close')
    resetForm()
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    saving.value = false
  }
}

function resetForm() {
  selectedAccountId.value = ''
  alias.value = ''
  propFirm.value = ''
  firmSearch.value = ''
  phase.value = 'Phase 1'
  targetPct.value = 8
  owner.value = ''
  startingBalance.value = 0
  cost.value = ''
  dailyDdPct.value = ''
  maxDdPct.value = ''
  startedAt.value = ''
  errorMsg.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="emit('close')">
        <div class="modal">
          <div class="modal-accent" />
          <div class="modal-header">
            <div class="modal-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <h2>Add Challenge</h2>
            </div>
            <button class="btn-close" @click="emit('close')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form class="modal-body" @submit.prevent="handleSubmit">
            <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

            <div class="form-group">
              <label>MetaCopier Account</label>
              <select v-model="selectedAccountId" class="form-input">
                <option value="" disabled>Select an account...</option>
                <option v-for="acc in unlinkedAccounts" :key="acc.id" :value="acc.id">
                  {{ acc.name || acc.login }} / {{ acc.server }} ({{ acc.platform }})
                </option>
              </select>
              <p v-if="unlinkedAccounts.length === 0" class="form-hint">
                All MetaCopier accounts are already tracked.
              </p>
            </div>

            <div class="form-group">
              <label>Alias</label>
              <input v-model="alias" type="text" class="form-input" placeholder="e.g. FTMO 100k #1" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Phase / Type</label>
                <select v-model="phase" class="form-input">
                  <option value="Phase 1">Phase 1</option>
                  <option value="Phase 2">Phase 2</option>
                  <option value="Funded">Funded</option>
                  <option value="Master">Master</option>
                </select>
              </div>
              <div class="form-group" v-if="phase !== 'Master'">
                <label>Prop Firm</label>
                <div class="firm-combobox">
                  <input
                    v-model="firmSearch"
                    type="text"
                    class="form-input"
                    placeholder="Search firm..."
                    @focus="onFirmFocus"
                    @blur="onFirmBlur"
                    autocomplete="off"
                  />
                  <ul v-if="firmDropdownOpen && filteredFirms.length" class="firm-dropdown">
                    <li
                      v-for="f in filteredFirms"
                      :key="f.id"
                      @mousedown.prevent="selectFirm(f.name)"
                      :class="{ active: f.name === propFirm }"
                    >{{ f.name }}</li>
                  </ul>
                  <div v-if="firmDropdownOpen && filteredFirms.length === 0" class="firm-dropdown firm-no-results">
                    No firms found
                  </div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Starting Balance ($)</label>
                <input v-model.number="startingBalance" type="number" step="0.01" min="0" class="form-input" placeholder="e.g. 10000" />
              </div>
              <div class="form-group">
                <label>Account Cost ($)</label>
                <input v-model="cost" type="number" step="0.01" min="0" class="form-input" placeholder="e.g. 549" />
              </div>
            </div>

            <div class="form-group">
              <label>Challenge Start Date</label>
              <input v-model="startedAt" type="date" class="form-input" />
              <p class="form-hint">Leave blank to use today. Set this if the challenge started before you added it.</p>
            </div>

            <div class="form-row" v-if="phase !== 'Master'">
              <div class="form-group">
                <label>Daily DD %</label>
                <input v-model="dailyDdPct" type="number" step="0.5" min="0" class="form-input" placeholder="e.g. 5" />
              </div>
              <div class="form-group">
                <label>Max DD %</label>
                <input v-model="maxDdPct" type="number" step="0.5" min="0" class="form-input" placeholder="e.g. 10" />
              </div>
            </div>

            <div class="form-row" v-if="phase !== 'Master'">
              <div class="form-group">
                <label>Target %</label>
                <input v-model.number="targetPct" type="number" step="0.5" min="0" class="form-input" />
              </div>
              <div class="form-group">
                <label>Owner</label>
                <input v-model="owner" type="text" class="form-input" placeholder="Trader name" />
              </div>
            </div>

            <div class="form-group" v-if="phase === 'Master'">
              <label>Owner</label>
              <input v-model="owner" type="text" class="form-input" placeholder="Trader name" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" @click="emit('close')">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Adding...' : 'Add Challenge' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ─── Overlay ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 1000;
}

/* ─── Transitions ─── */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal { animation: slideDown 0.3s var(--ease-out); }

/* ─── Modal ─── */
.modal {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  opacity: 0.5;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--accent);
}

.modal-title h2 {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-close:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

/* ─── Form ─── */
.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-msg {
  padding: 8px 12px;
  background: var(--red-muted);
  border: 1px solid rgba(255, 71, 87, 0.2);
  border-radius: var(--radius-sm);
  color: var(--red);
  font-size: 12px;
  font-family: var(--font-mono);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.form-group label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.form-input {
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-muted);
}

.form-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

.firm-combobox {
  position: relative;
}

.firm-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.firm-dropdown li {
  padding: 7px 12px;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.1s;
}

.firm-dropdown li:hover,
.firm-dropdown li.active {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.firm-dropdown li.active {
  color: var(--accent);
}

.firm-no-results {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.form-row {
  display: flex;
  gap: 12px;
}

/* ─── Footer ─── */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
}

.btn-secondary {
  padding: 8px 18px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-primary {
  padding: 8px 20px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--bg);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-primary:hover {
  background: var(--accent-bright);
  box-shadow: 0 2px 12px var(--accent-muted);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .modal {
    width: 100%;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    height: 100vh;
  }

  .modal-accent {
    border-radius: 0;
  }

  .form-row {
    flex-direction: column;
    gap: 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-header {
    padding: 14px 16px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-footer button {
    width: 100%;
    justify-content: center;
    padding: 12px;
  }
}
</style>
