<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()

const icons: Record<string, string> = {
  success: '✓',
  error:   '✕',
  warn:    '⚠',
  info:    '●',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast" tag="div" class="toast-inner">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          @click="remove(toast.id)"
        >
          <span class="toast-icon">{{ icons[toast.type] }}</span>
          <span class="toast-msg">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9998;
  pointer-events: none;
}

.toast-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  max-width: 320px;
  cursor: pointer;
  pointer-events: all;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
}

.toast-icon {
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.toast-success {
  background: rgba(15, 17, 21, 0.92);
  border-color: rgba(34, 197, 94, 0.35);
  color: #22c55e;
}

.toast-error {
  background: rgba(15, 17, 21, 0.92);
  border-color: rgba(239, 68, 68, 0.35);
  color: #ef4444;
}

.toast-warn {
  background: rgba(15, 17, 21, 0.92);
  border-color: rgba(240, 180, 41, 0.35);
  color: var(--accent, #f0b429);
}

.toast-info {
  background: rgba(15, 17, 21, 0.92);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}

.toast-msg { line-height: 1.4; }

/* Transitions */
.toast-enter-active { transition: all 0.2s ease; }
.toast-leave-active { transition: all 0.18s ease; }
.toast-enter-from  { opacity: 0; transform: translateX(16px); }
.toast-leave-to    { opacity: 0; transform: translateX(16px); }

@media (max-width: 640px) {
  .toast-stack {
    bottom: 16px;
    right: 12px;
    left: 12px;
  }
  .toast { max-width: 100%; }
  .toast-inner { align-items: stretch; }
}
</style>
