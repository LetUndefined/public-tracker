import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return err('Method not allowed', 405)

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err('Unauthorized', 401)
    const jwt = authHeader.slice(7)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return err(`Unauthorized: ${authErr?.message ?? 'no user'}`, 401)

    // 2. Verify admin status
    const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin', { p_user_id: user.id })
    if (adminErr) return err(`Admin check failed: ${adminErr.message}`, 500)
    if (!isAdmin) return err('Forbidden', 403)

    // 3. Fetch all users via admin auth API
    const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (usersErr) return err(`Failed to fetch users: ${usersErr.message}`, 500)

    // 4. Fetch all challenges (only columns guaranteed to exist)
    const { data: challenges, error: chErr } = await supabase
      .from('challenges')
      .select('id, user_id, alias, starting_balance, target_pct, created_at')
      .order('created_at', { ascending: false })
    if (chErr) return err(`Failed to fetch challenges: ${chErr.message}`, 500)

    // 5. Check which users have an API key via vault lookup
    let keyUserIds = new Set<string>()
    try {
      const { data: vaultSecrets } = await supabase
        .from('vault.secrets')
        .select('name')
      keyUserIds = new Set(
        (vaultSecrets ?? [])
          .map((s: any) => s.name)
          .filter((n: string) => n.startsWith('metacopier_key_'))
          .map((n: string) => n.replace('metacopier_key_', ''))
      )
    } catch {
      // vault.secrets may not be accessible — has_api_key will show false
    }

    // 6. Build response — never include API keys or password hashes
    const userData = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
      has_api_key: keyUserIds.has(u.id),
      challenges: (challenges ?? []).filter((c: any) => c.user_id === u.id),
    }))

    return new Response(JSON.stringify({ users: userData }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (e: any) {
    return err(`Unexpected error: ${e?.message ?? String(e)}`, 500)
  }
})
