import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const isAdmin = ref<boolean | null>(null) // null = not yet checked

// Reset whenever the auth session changes so stale admin state never persists
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
    isAdmin.value = null
  }
})

export function useAdmin() {
  async function checkAdmin(): Promise<boolean> {
    if (isAdmin.value !== null) return isAdmin.value
    const { data } = await supabase.rpc('is_admin')
    isAdmin.value = data === true
    return isAdmin.value
  }

  function resetAdmin() {
    isAdmin.value = null
  }

  async function fetchAdminData() {
    const { data, error } = await supabase.functions.invoke('admin-data')
    if (error) {
      const ctx = (error as any).context
      if (ctx instanceof Response) {
        try {
          const body = await ctx.json()
          throw new Error(body?.error ?? error.message)
        } catch (inner: any) {
          if (inner.message && inner.message !== 'Failed to load admin data') throw inner
        }
      }
      throw new Error(error.message ?? 'Failed to load admin data')
    }
    return data
  }

  return { isAdmin, checkAdmin, resetAdmin, fetchAdminData }
}
