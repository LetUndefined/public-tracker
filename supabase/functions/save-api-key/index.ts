import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function corsOk() {
  return new Response(null, { headers: CORS })
}

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function ok(data: object) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOk()
  if (req.method !== 'POST') return err('Method not allowed', 405)

  try {
    // ── 1. Verify JWT ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err('Unauthorized', 401)
    const jwt = authHeader.slice(7)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return err(`Unauthorized: ${authErr?.message ?? 'no user'}`, 401)

    // ── 2. Parse body ──────────────────────────────────────────
    let body: { api_key?: string }
    try {
      body = await req.json()
    } catch {
      return err('Invalid JSON body', 400)
    }

    const apiKey = body.api_key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return err('Invalid API key format', 400)
    }
    const trimmedKey = apiKey.trim()

    // ── 3. Validate key against MetaCopier ────────────────────
    try {
      const testRes = await fetch('https://api.metacopier.io/rest/api/v1/accounts', {
        headers: { 'X-API-KEY': trimmedKey },
      })
      if (!testRes.ok) {
        return err(`MetaCopier rejected this API key (${testRes.status})`, 400)
      }
    } catch (fetchErr: any) {
      return err(`MetaCopier unreachable: ${fetchErr.message}`, 502)
    }

    // ── 4. Store in Vault ──────────────────────────────────────
    const { error: vaultErr } = await supabase.rpc('upsert_metacopier_key', {
      p_user_id: user.id,
      p_api_key: trimmedKey,
    })
    if (vaultErr) {
      return err(`Vault error: ${vaultErr.message}`, 500)
    }

    return ok({ success: true })

  } catch (e: any) {
    return err(`Unexpected error: ${e?.message ?? String(e)}`, 500)
  }
})
