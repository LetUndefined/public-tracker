import { ref } from 'vue'

const TOUR_KEY = 'ct_tour_done'

const active = ref(false)
const stepIndex = ref(0)

export function useTour() {
  function startTour() {
    stepIndex.value = 0
    active.value = true
  }

  function stopTour() {
    active.value = false
    localStorage.setItem(TOUR_KEY, '1')
  }

  function advance(totalSteps: number) {
    if (stepIndex.value >= totalSteps - 1) {
      stopTour()
    } else {
      stepIndex.value++
    }
  }

  function hasSeenTour(): boolean {
    return !!localStorage.getItem(TOUR_KEY)
  }

  return { active, stepIndex, startTour, stopTour, advance, hasSeenTour }
}
