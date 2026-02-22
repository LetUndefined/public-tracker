import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const METACOPIER_BASE = 'https://api.metacopier.io/rest/api/v1'

const ALLOWED_PATH_PATTERNS = [
  /^\/accounts$/,
  /^\/accounts\/[a-zA-Z0-9_-]+\/information$/,
  /^\/accounts\/[a-zA-Z0-9_-]+\/positions$/,
  /^\/accounts\/[a-zA-Z0-9_-]+\/history\/positions$/,
]

function corsOk(req: Request) {
  return new Response(null, { headers: corsHeaders(req) })
}

function err(req: Request, msg: string, status: number, internal?: string) {
  if (internal) console.error(`[proxy-metacopier] ${status}: ${internal}`)
  return new Response(JSON.stringify({ error: msg }), {
    status,
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

    const { data: allowed, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'proxy-metacopier',
      p_max_calls: 60,   // ~6 calls per poll cycle × 10x burst headroom
      p_window_seconds: 60,
    })
    if (rlErr) return err(req, 'Service unavailable', 500, `Rate limit RPC: ${rlErr.message}`)
    if (!allowed) return err(req, 'Rate limit exceeded', 429)

    let body: { path: string; params?: Record<string, string> }
    try {
      body = await req.json()
    } catch {
      return err(req, 'Invalid request', 400)
    }

    const { path, params } = body
    if (!path || typeof path !== 'string') return err(req, 'Invalid request', 400)

    const cleanPath = path.split('?')[0]
    if (!ALLOWED_PATH_PATTERNS.some((r) => r.test(cleanPath))) {
      return err(req, 'Forbidden', 403, `Blocked path: ${cleanPath}`)
    }

    const { data: apiKey, error: vaultErr } = await supabase.rpc('get_metacopier_key', {
      p_user_id: user.id,
    })
    if (vaultErr) return err(req, 'Service unavailable', 500, `Vault RPC: ${vaultErr.message}`)
    if (!apiKey) return err(req, 'API key not configured', 403)

    const url = new URL(METACOPIER_BASE + cleanPath)
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      const entries = Object.entries(params)
      if (entries.length > 10) return err(req, 'Invalid request', 400, 'Too many params')
      for (const [k, v] of entries) {
        if (typeof k !== 'string' || typeof v !== 'string') continue
        if (k.length > 50 || v.length > 200) return err(req, 'Invalid request', 400, 'Param too large')
        url.searchParams.set(k, v)
      }
    }

    let upstream: Response
    try {
      upstream = await fetch(url.toString(), {
        headers: { 'X-API-KEY': apiKey },
      })
    } catch (fetchErr: any) {
      return err(req, 'Upstream service unavailable', 502, fetchErr.message)
    }

    const data = await upstream.json()

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (e: any) {
    return err(req, 'Internal server error', 500, e?.message ?? String(e))
  }
})
