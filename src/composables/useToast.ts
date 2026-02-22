import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warn'

export interface Toast {
  id: number
  type: ToastType
  message: string
  duration: number
}

const toasts = ref<Toast[]>([])
let nextId = 1

export function useToast() {
  function add(message: string, type: ToastType = 'info', duration = 3500) {
    const id = nextId++
    toasts.value.push({ id, type, message, duration })
    setTimeout(() => remove(id), duration)
  }

  function remove(id: number) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  const success = (msg: string) => add(msg, 'success')
  const error   = (msg: string) => add(msg, 'error', 5000)
  const warn    = (msg: string) => add(msg, 'warn')
  const info    = (msg: string) => add(msg, 'info')

  return { toasts, add, remove, success, error, warn, info }
}
