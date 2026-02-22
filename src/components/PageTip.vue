<script setup lang="ts">
import { computed } from 'vue'
import { usePageTour } from '@/composables/usePageTour'

const { active, stepIndex, steps, dismiss, next } = usePageTour()

const current = computed(() => steps.value[stepIndex.value])
const isLast  = computed(() => stepIndex.value === steps.value.length - 1)
const total   = computed(() => steps.value.length)
</script>

<template>
  <Teleport to="body">
    <Transition name="tip-slide">
      <div v-if="active && current" class="page-tip">

        <div class="tip-header">
          <div class="tip-pips">
            <span
              v-for="(_, i) in steps"
              :key="i"
              class="tip-pip"
              :class="{ active: i === stepIndex, done: i < stepIndex }"
            />
          </div>
          <button class="tip-close" @click="dismiss" title="Dismiss">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="tip-eyebrow">QUICK GUIDE · {{ stepIndex + 1 }}/{{ total }}</div>
        <div class="tip-title">{{ current.title }}</div>
        <div class="tip-body">{{ current.body }}</div>

        <div class="tip-footer">
          <button class="tip-skip" @click="dismiss">Dismiss</button>
          <button class="tip-next" @click="next">
            {{ isLast ? 'Got it ✓' : 'Next →' }}
          </button>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.page-tip {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 8000;
  width: 300px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 14px 16px 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(240,180,41,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Header ── */
.tip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tip-pips {
  display: flex;
  gap: 4px;
}

.tip-pip {
  height: 3px;
  width: 14px;
  border-radius: 2px;
  background: var(--border);
  transition: background 0.2s, width 0.2s;
}

.tip-pip.done   { background: rgba(240,180,41,0.35); }
.tip-pip.active { background: var(--accent); width: 20px; }

.tip-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.12s;
  padding: 0;
}

.tip-close:hover { color: var(--text-secondary); }

/* ── Text ── */
.tip-eyebrow {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--accent);
  opacity: 0.8;
  margin-top: -2px;
}

.tip-title {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.tip-body {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ── Footer ── */
.tip-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
  margin-top: 2px;
}

.tip-skip {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.12s;
}

.tip-skip:hover { color: var(--text-secondary); }

.tip-next {
  padding: 5px 13px;
  background: var(--accent);
  border: none;
  border-radius: 5px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: #0a0b0f;
  cursor: pointer;
  transition: opacity 0.15s;
}

.tip-next:hover { opacity: 0.88; }

/* ── Transition ── */
.tip-slide-enter-active { transition: opacity 0.22s, transform 0.22s; }
.tip-slide-leave-active { transition: opacity 0.18s, transform 0.18s; }
.tip-slide-enter-from   { opacity: 0; transform: translateY(12px); }
.tip-slide-leave-to     { opacity: 0; transform: translateY(8px); }

@media (max-width: 640px) {
  .page-tip {
    bottom: 16px;
    right: 16px;
    left: 16px;
    width: auto;
  }
}
</style>
