const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOWED_METHODS = "GET, POST, OPTIONS";

function getAllowedOrigin(requestOrigin?: string | null): string {
  const appBase = (typeof Deno !== "undefined" ? Deno.env.get("APP_BASE_URL") : "") || "";
  // In production: only echo the origin if it matches APP_BASE_URL
  if (appBase && requestOrigin) {
    const allowed = appBase.replace(/\/+$/, "");
    if (requestOrigin === allowed) return requestOrigin;
  }
  // In local dev (no APP_BASE_URL set): allow localhost origins
  if (!appBase && requestOrigin && /^https?:\/\/localhost(:\d+)?$/.test(requestOrigin)) {
    return requestOrigin;
  }
  // Fallback: deny (empty origin = browser won't allow the response)
  return "";
}

export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? undefined;
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    Vary: "Origin",
  };
}

export function jsonResponse(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}
