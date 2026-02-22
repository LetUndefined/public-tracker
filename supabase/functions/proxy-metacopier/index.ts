import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const METACOPIER_BASE = 'https://api.metacopier.io/rest/api/v1'

// Only these paths may be proxied -- no wildcard, no arbitrary URLs
const ALLOWED_PATH_PATTERNS = [
  /^\/accounts$/,
  /^\/accounts\/[a-zA-Z0-9_-]+\/information$/,
  /^\/accounts\/[a-zA-Z0-9_-]+\/positions$/,
  /^\/accounts\/[a-zA-Z0-9_-]+\/history\/positions$/,
]

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsOk()
  if (req.method !== 'POST') return err('Method not allowed', 405)

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err('Unauthorized: missing bearer token', 401)
    const jwt = authHeader.slice(7)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return err(`Unauthorized: ${authErr?.message ?? 'no user'}`, 401)

    // 2. Rate limit
    const { data: allowed, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'proxy-metacopier',
      p_max_calls: 600,
      p_window_seconds: 60,
    })
    if (rlErr) return err(`Rate limit RPC error: ${rlErr.message}`, 500)
    if (!allowed) return err('Rate limit exceeded', 429)

    // 3. Parse and validate request body
    let body: { path: string; params?: Record<string, string> }
    try {
      body = await req.json()
    } catch {
      return err('Invalid JSON body', 400)
    }

    const { path, params } = body
    if (!path || typeof path !== 'string') return err('Missing path', 400)

    // Strip any query strings from path before allowlist check
    const cleanPath = path.split('?')[0]
    if (!ALLOWED_PATH_PATTERNS.some((r) => r.test(cleanPath))) {
      return err(`Forbidden path: ${cleanPath}`, 403)
    }

    // 4. Get API key from Vault
    const { data: apiKey, error: vaultErr } = await supabase.rpc('get_metacopier_key', {
      p_user_id: user.id,
    })
    if (vaultErr) return err(`Vault RPC error: ${vaultErr.message}`, 500)
    if (!apiKey) return err('No MetaCopier API key configured for this user', 403)

    // 5. Proxy to MetaCopier
    const url = new URL(METACOPIER_BASE + cleanPath)
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'string') {
          url.searchParams.set(k, v)
        }
      })
    }

    let upstream: Response
    try {
      upstream = await fetch(url.toString(), {
        headers: { 'X-API-KEY': apiKey },
      })
    } catch (fetchErr: any) {
      return err(`MetaCopier unreachable: ${fetchErr.message}`, 502)
    }

    const data = await upstream.json()

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (e: any) {
    return err(`Unexpected error: ${e?.message ?? String(e)}`, 500)
  }
})
