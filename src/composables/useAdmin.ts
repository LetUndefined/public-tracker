import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const isAdmin = ref<boolean | null>(null) // null = not checked yet

export function useAdmin() {
  async function checkAdmin(): Promise<boolean> {
    if (isAdmin.value !== null) return isAdmin.value
    const { data } = await supabase.rpc('is_admin')
    isAdmin.value = !!data
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
