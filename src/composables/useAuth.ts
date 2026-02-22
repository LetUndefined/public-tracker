import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const user = ref<User | null>(null)
const loading = ref(true)
let initialized = false

export function useAuth() {
  if (!initialized) {
    initialized = true

    // Load initial session
    supabase.auth.getSession().then(({ data }) => {
      user.value = data.session?.user ?? null
      loading.value = false
    })

    // Keep in sync with auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
      loading.value = false
    })
  }

  const isAuthenticated = computed(() => !!user.value)

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  return {
    user,
    loading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    getAccessToken,
  }
}
