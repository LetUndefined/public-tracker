import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function corsOk(req: Request) {
  return new Response(null, { headers: corsHeaders(req) })
}

function err(req: Request, msg: string, status: number, internal?: string) {
  if (internal) console.error(`[save-api-key] ${status}: ${internal}`)
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function ok(req: Request, data: object) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOk(req)
  if (req.method !== 'POST') return err(req, 'Method not allowed', 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err(req, 'Unauthorized', 401)
    const jwt = authHeader.slice(7)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return err(req, 'Unauthorized', 401, authErr?.message)

    // Rate limit: max 10 key saves per hour per user
    const { data: allowed, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'save-api-key',
      p_max_calls: 10,
      p_window_seconds: 3600,
    })
    if (rlErr) return err(req, 'Service unavailable', 500, `Rate limit RPC: ${rlErr.message}`)
    if (!allowed) return err(req, 'Too many attempts — try again later', 429)

    let body: { api_key?: string }
    try {
      body = await req.json()
    } catch {
      return err(req, 'Invalid request', 400)
    }

    const apiKey = body.api_key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return err(req, 'Invalid API key format', 400)
    }
    const trimmedKey = apiKey.trim()

    // Validate key against MetaCopier before storing
    try {
      const testRes = await fetch('https://api.metacopier.io/rest/api/v1/accounts', {
        headers: { 'X-API-KEY': trimmedKey },
      })
      if (!testRes.ok) {
        return err(req, 'Invalid API key — MetaCopier rejected it', 400, `MC status: ${testRes.status}`)
      }
    } catch (fetchErr: any) {
      return err(req, 'Could not reach MetaCopier to validate key', 502, fetchErr.message)
    }

    const { error: vaultErr } = await supabase.rpc('upsert_metacopier_key', {
      p_user_id: user.id,
      p_api_key: trimmedKey,
    })
    if (vaultErr) {
      return err(req, 'Failed to save key', 500, `Vault: ${vaultErr.message}`)
    }

    return ok(req, { success: true })

  } catch (e: any) {
    return err(req, 'Internal server error', 500, e?.message ?? String(e))
  }
})
