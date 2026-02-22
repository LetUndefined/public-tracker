// Shared CORS helper — restricts to known origins only
const ALLOWED_ORIGINS = [
  'https://letundefined.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
]

export function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
