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

// Verify and decode the Supabase JWT locally — no auth API round-trip.
// Uses HMAC-SHA256 (Supabase's default JWT algorithm).
async function verifyJwt(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    const signedPart = parts[0] + '.' + parts[1]
    const sigBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    )

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(signedPart),
    )
    if (!valid) return null

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Date.now() / 1000) return null

    return { sub: payload.sub }
  } catch {
    return null
  }
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

    // Prefer local JWT verification (no auth API round-trip).
    // Falls back to getUser() if SUPABASE_JWT_SECRET is not set as a secret.
    let userId: string
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')
    if (jwtSecret) {
      const payload = await verifyJwt(jwt, jwtSecret)
      if (!payload?.sub) return err(req, 'Unauthorized', 401)
      userId = payload.sub
    } else {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
      if (authErr || !user) return err(req, 'Unauthorized', 401, authErr?.message)
      userId = user.id
    }

    const { data: allowed, error: rlErr } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: 'proxy-metacopier',
      p_max_calls: 100,  // per 60s: (1 + 2N) live + N/3 history; 100 covers ~15 accounts with burst headroom
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
      p_user_id: userId,
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
