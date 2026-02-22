import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function err(req: Request, msg: string, status: number, internal?: string) {
  if (internal) console.error(`[admin-data] ${status}: ${internal}`)
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) })
  if (req.method !== 'POST') return err(req, 'Method not allowed', 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err(req, 'Unauthorized', 401)
    const jwt = authHeader.slice(7)

    // Parse optional action body early so we can branch below
    let body: { action?: string; id?: string } = {}
    try { body = await req.clone().json() } catch { /* no body is fine */ }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return err(req, 'Unauthorized', 401, authErr?.message)

    const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin', { p_user_id: user.id })
    if (adminErr) return err(req, 'Forbidden', 403, `Admin check: ${adminErr.message}`)
    if (!isAdmin) return err(req, 'Forbidden', 403)

    // ── mark-as-read action ──────────────────────────────────────
    if (body.action === 'markRead' && body.id) {
      const { error: upErr } = await supabase
        .from('feedback')
        .update({ read: true })
        .eq('id', body.id)
      if (upErr) return err(req, 'Failed to update', 500, upErr.message)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: allowed, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'admin-data',
      p_max_calls: 10,
      p_window_seconds: 60,
    })
    if (rlErr) return err(req, 'Service unavailable', 500, `Rate limit RPC: ${rlErr.message}`)
    if (!allowed) return err(req, 'Rate limit exceeded', 429)

    // Paginate through ALL users — listUsers caps at 1000 per page
    const allUsers: any[] = []
    let page = 1
    while (true) {
      const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (usersErr) return err(req, 'Failed to fetch users', 500, usersErr.message)
      allUsers.push(...users)
      if (users.length < 1000) break
      page++
    }

    const { data: challenges, error: chErr } = await supabase
      .from('challenges')
      .select('id, user_id, alias, prop_firm, phase, starting_balance, target_pct, created_at')
      .order('created_at', { ascending: false })
    if (chErr) return err(req, 'Failed to fetch challenges', 500, chErr.message)

    // Feedback inbox
    const { data: feedbackRows } = await supabase
      .from('feedback')
      .select('id, user_id, email, message, category, read, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    // System-wide history stats
    const { data: histRows } = await supabase
      .from('challenge_history')
      .select('outcome, payout_received')
    const histPassed   = (histRows ?? []).filter((h: any) => h.outcome === 'Passed').length
    const histFailed   = (histRows ?? []).filter((h: any) => h.outcome === 'Failed').length
    const histExtracted = (histRows ?? []).reduce((s: number, h: any) => s + (h.payout_received ?? 0), 0)

    // Use RPC to check which users have API keys — never read vault.secrets directly
    let keyUserIds = new Set<string>()
    try {
      const { data: keyRows } = await supabase.rpc('list_users_with_metacopier_key')
      keyUserIds = new Set((keyRows ?? []) as string[])
    } catch {
      // Non-critical — has_api_key will show false if RPC not set up
    }

    const userData = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
      has_api_key: keyUserIds.has(u.id),
      challenges: (challenges ?? []).filter((c: any) => c.user_id === u.id),
    }))

    return new Response(JSON.stringify({
      users: userData,
      system: { histPassed, histFailed, histExtracted },
      feedback: feedbackRows ?? [],
    }), {
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (e: any) {
    return err(req, 'Internal server error', 500, e?.message ?? String(e))
  }
})
