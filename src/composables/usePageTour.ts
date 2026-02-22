import { ref } from 'vue'

export interface PageStep {
  title: string
  body: string
}

const active   = ref(false)
const stepIndex = ref(0)
const steps     = ref<PageStep[]>([])

export function usePageTour() {
  function startPageTour(pageKey: string, pageSteps: PageStep[]) {
    if (localStorage.getItem(`ct_page_${pageKey}`)) return
    localStorage.setItem(`ct_page_${pageKey}`, '1')
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
