import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface PageStep {
  title: string
  body: string
}

const active    = ref(false)
const stepIndex = ref(0)
const steps     = ref<PageStep[]>([])

// In-memory cache of seen keys for the current session
const seenKeys  = ref<Set<string>>(new Set())
let metaLoaded  = false

async function loadSeenKeys() {
  if (metaLoaded) return
  metaLoaded = true
  const { data } = await supabase.auth.getUser()
  const seen: string[] = data?.user?.user_metadata?.tours_seen ?? []
  seenKeys.value = new Set(seen)
}

async function markSeen(key: string) {
  seenKeys.value.add(key)
  const { data } = await supabase.auth.getUser()
  const existing: string[] = data?.user?.user_metadata?.tours_seen ?? []
  if (!existing.includes(key)) {
    await supabase.auth.updateUser({
      data: { tours_seen: [...existing, key] },
    })
  }
}

export function usePageTour() {
  async function startPageTour(pageKey: string, pageSteps: PageStep[]) {
    await loadSeenKeys()
    if (seenKeys.value.has(pageKey)) return
    await markSeen(pageKey)
    steps.value     = pageSteps
    stepIndex.value = 0
    active.value    = true
  }

  function dismiss() { active.value = false }

  function next() {
    if (stepIndex.value >= steps.value.length - 1) dismiss()
    else stepIndex.value++
  }

  return { active, stepIndex, steps, startPageTour, dismiss, next }
}
