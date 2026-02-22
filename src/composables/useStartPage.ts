import { ref } from 'vue'

const STORAGE_KEY = 'ct_start_page'

export interface StartPageOption {
  path: string
  label: string
}

export const START_PAGE_OPTIONS: StartPageOption[] = [
  { path: '/',              label: 'Landing Page'      },
  { path: '/dashboard',     label: 'Dashboard'         },
  { path: '/notifications', label: 'Notifications'     },
  { path: '/analytics',     label: 'Analytics'         },
  { path: '/payouts',       label: 'Payouts'           },
  { path: '/history',       label: 'History'           },
  { path: '/compare',       label: 'Compare Prop Firms'},
]

const startPage = ref<string>(localStorage.getItem(STORAGE_KEY) ?? '/')

export function useStartPage() {
  function setStartPage(path: string) {
    startPage.value = path
    localStorage.setItem(STORAGE_KEY, path)
  }

  return { startPage, setStartPage, START_PAGE_OPTIONS }
}
