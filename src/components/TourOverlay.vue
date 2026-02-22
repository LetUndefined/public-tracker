<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useTour } from '@/composables/useTour'

const { active, stepIndex, stopTour, advance } = useTour()

const PAD = 10

interface Step {
  target: string | null
  title: string
  body: string
}

const steps: Step[] = [
  {
    target: null,
    title: 'Welcome to Challenge Tracker',
    body: 'This quick guide walks you through the main features. Takes about 30 seconds. You can skip at any time.',
  },
  {
    target: '[data-tour="stats-bar"]',
    title: 'Portfolio Overview',
    body: 'Live totals across all your challenges — total balance, equity, open P&L, daily P&L, and fees paid. Updates every 60s.',
  },
  {
    target: '[data-tour="challenge-table"]',
    title: 'Challenge Dashboard',
    body: 'Each row is a funded account. See live balance, equity, progress toward your profit target, open P&L, and current win/loss streak.',
  },
  {
    target: '[data-tour="add-challenge"]',
    title: 'Add a Challenge',
    body: 'Link a MetaCopier account to a challenge. Set the prop firm, phase, and starting balance to begin tracking progress.',
  },
  {
    target: '[data-tour="nav-notifications"]',
    title: 'Trade Alerts',
    body: 'Get push notifications when trades open or close, when you hit your profit target, or when you\'re approaching your drawdown limit.',
  },
  {
    target: '[data-tour="nav-analytics"]',
    title: 'Analytics',
    body: 'Deep-dive into your trading performance — equity curves, win rate, profit factor, streaks, and a full daily P&L breakdown.',
  },
  {
    target: '[data-tour="nav-payouts"]',
    title: 'Payout Tracker',
    body: 'Log every payout from your prop firms. See total capital extracted, pending payouts, and a full ledger of your history.',
  },
  {
    target: '[data-tour="nav-compare"]',
    title: 'Compare Prop Firms',
    body: 'Side-by-side comparison of all major prop firms — drawdown rules, fees, profit splits, and trading restrictions.',
  },
  {
    target: null,
    title: "You're all set!",
    body: 'That covers the main features. You can restart this guide anytime from Settings.',
  },
]

const TOTAL = steps.length
const rect = ref<DOMRect | null>(null)

const current = computed(() => steps[stepIndex.value] ?? null)
const isLast  = computed(() => stepIndex.value === TOTAL - 1)

/* ── Spotlight panel styles ── */
const panelTop = computed(() => !rect.value ? {} : {
  top: '0', left: '0', right: '0',
  height: `${Math.max(0, rect.value.top - PAD)}px`,
})
const panelLeft = computed(() => !rect.value ? {} : {
  top: `${rect.value.top - PAD}px`, left: '0',
  width: `${Math.max(0, rect.value.left - PAD)}px`,
  height: `${rect.value.height + PAD * 2}px`,
})
const panelRight = computed(() => !rect.value ? {} : {
  top: `${rect.value.top - PAD}px`,
  left: `${rect.value.right + PAD}px`, right: '0',
  height: `${rect.value.height + PAD * 2}px`,
})
const panelBottom = computed(() => !rect.value ? {} : {
  top: `${rect.value.bottom + PAD}px`, left: '0', right: '0', bottom: '0',
})
const highlightStyle = computed(() => !rect.value ? {} : {
  top: `${rect.value.top - PAD}px`,
  left: `${rect.value.left - PAD}px`,
  width: `${rect.value.width + PAD * 2}px`,
  height: `${rect.value.height + PAD * 2}px`,
})

/* ── Card position ── */
const CARD_W = 340
const CARD_H = 200
const MARGIN = 16

const cardStyle = computed(() => {
  // No target → centered
  if (!rect.value || !current.value?.target) {
    return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }
  const r = rect.value
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampLeft = (x: number) => Math.min(Math.max(x, MARGIN), vw - CARD_W - MARGIN)

  // Prefer below
  if (r.bottom + PAD + CARD_H + 8 < vh) {
    return { top: `${r.bottom + PAD + 8}px`, left: `${clampLeft(r.left)}px` }
  }
  // Try above
  if (r.top - PAD - CARD_H - 8 > 0) {
    return { top: `${r.top - PAD - CARD_H - 8}px`, left: `${clampLeft(r.left)}px` }
  }
  // Fallback: bottom of screen
  return {
    bottom: `${MARGIN}px`,
    left: `${clampLeft(r.left)}px`,
  }
})

/* ── Update rect on step change ── */
async function updateRect() {
  const target = current.value?.target
  if (!target) { rect.value = null; return }

  const el = document.querySelector(target)
  if (!el) { rect.value = null; return }

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  await new Promise(r => setTimeout(r, 320))
  rect.value = el.getBoundingClientRect()
}

watch([active, stepIndex], async ([isActive]) => {
  if (isActive) { await nextTick(); await updateRect() }
}, { immediate: true })

function onResize() { updateRect() }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <Teleport to="body">
    <Transition name="tour-fade">
      <div v-if="active && current" class="tour-root">

        <!-- 4-panel spotlight when we have a rect -->
        <template v-if="rect">
          <div class="tour-panel" :style="panelTop" />
          <div class="tour-panel" :style="panelLeft" />
          <div class="tour-panel" :style="panelRight" />
          <div class="tour-panel" :style="panelBottom" />
          <div class="tour-highlight" :style="highlightStyle" />
        </template>

        <!-- Full veil for centered (no-target) steps -->
        <div v-else class="tour-veil" />

        <!-- Tooltip card -->
        <div class="tour-card" :style="cardStyle">
          <div class="tour-card-header">
            <div class="tour-step-pip">
              <span
                v-for="(_, i) in steps"
                :key="i"
                class="pip"
                :class="{ active: i === stepIndex, done: i < stepIndex }"
              />
            </div>
            <button class="tour-skip-btn" @click="stopTour" title="Skip guide">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="tour-eyebrow">STEP {{ stepIndex + 1 }} / {{ TOTAL }}</div>
          <div class="tour-title">{{ current.title }}</div>
          <div class="tour-body">{{ current.body }}</div>

          <div class="tour-actions">
            <button class="tour-skip-text" @click="stopTour">Skip guide</button>
            <button class="tour-next-btn" @click="advance(TOTAL)">
              {{ isLast ? 'Done ✓' : 'Next →' }}
            </button>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tour-root {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
}

/* ── Spotlight panels ── */
.tour-panel {
  position: fixed;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: all;
}

.tour-veil {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: all;
}

/* ── Highlight ring ── */
.tour-highlight {
  position: fixed;
  border: 2px solid var(--accent);
  border-radius: 6px;
  box-shadow:
    0 0 0 4px rgba(240, 180, 41, 0.12),
    0 0 24px rgba(240, 180, 41, 0.2);
  pointer-events: none;
  animation: tour-pulse 2s ease-in-out infinite;
}

@keyframes tour-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(240,180,41,0.12), 0 0 24px rgba(240,180,41,0.2); }
  50%       { box-shadow: 0 0 0 6px rgba(240,180,41,0.18), 0 0 32px rgba(240,180,41,0.3); }
}

/* ── Card ── */
.tour-card {
  position: fixed;
  width: 340px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(240,180,41,0.08);
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: all;
  z-index: 9010;
}

.tour-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── Progress pips ── */
.tour-step-pip {
  display: flex;
  gap: 4px;
  align-items: center;
}

.pip {
  width: 16px;
  height: 3px;
  border-radius: 2px;
  background: var(--border);
  transition: background 0.2s, width 0.2s;
}

.pip.done   { background: rgba(240,180,41,0.4); }
.pip.active { background: var(--accent); width: 24px; }

/* ── Close btn ── */
.tour-skip-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.tour-skip-btn:hover { border-color: var(--red); color: var(--red); }

/* ── Text ── */
.tour-eyebrow {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--accent);
  margin-top: -4px;
}

.tour-title {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.tour-body {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ── Actions ── */
.tour-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  border-top: 1px solid var(--border-subtle);
}

.tour-skip-text {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.tour-skip-text:hover { color: var(--text-secondary); }

.tour-next-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: #0a0b0f;
  cursor: pointer;
  transition: opacity 0.15s;
}

.tour-next-btn:hover { opacity: 0.88; }

/* ── Transitions ── */
.tour-fade-enter-active { transition: opacity 0.2s; }
.tour-fade-leave-active { transition: opacity 0.18s; }
.tour-fade-enter-from,
.tour-fade-leave-to     { opacity: 0; }

@media (max-width: 640px) {
  .tour-card {
    width: calc(100vw - 32px);
    left: 16px !important;
    right: 16px;
    bottom: 20px !important;
    top: auto !important;
    transform: none !important;
  }
}
</style>
