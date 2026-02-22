<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const show = ref(false)
const dismissed = ref(false)

onMounted(async () => {
  const { data } = await supabase.rpc('has_metacopier_key')
  show.value = !data
})

function dismiss() {
  dismissed.value = true
}
</script>

<template>
  <Transition name="banner">
    <div v-if="show && !dismissed" class="api-banner">
      <div class="banner-inner">
        <span class="banner-icon">⚠</span>
        <div class="banner-body">
          <span class="banner-title">MetaCopier API key required</span>
          <span class="banner-desc">Add your API key in Settings to start syncing your trading accounts.</span>
        </div>
        <button class="banner-cta" @click="router.push('/settings')">Go to Settings</button>
        <button class="banner-dismiss" @click="dismiss" title="Dismiss">✕</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.api-banner {
  background: rgba(240, 180, 41, 0.07);
  border-bottom: 1px solid rgba(240, 180, 41, 0.2);
  padding: 10px 20px;
  position: relative;
  z-index: 50;
}

.banner-inner {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-icon {
  font-size: 14px;
  color: var(--accent);
  flex-shrink: 0;
}

.banner-body {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.banner-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}

.banner-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.banner-cta {
  flex-shrink: 0;
  padding: 6px 14px;
  background: var(--accent);
  color: #0f1115;
  border: none;
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.banner-cta:hover { opacity: 0.85; }

.banner-dismiss {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.banner-dismiss:hover { color: var(--text-primary); }

.banner-enter-active, .banner-leave-active { transition: all 0.2s ease; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 640px) {
  .banner-body { flex-direction: column; gap: 2px; }
  .banner-desc { display: none; }
}
</style>
