import { randomBytes } from "node:crypto";
import { query, safeId, type Req, type Res } from "./_http.js";
import { kv } from "./_kv.js";
import { authorizeUrl, isConfigured, isProvider } from "./_oauth.js";

function baseUrl(req: Req): string {
  if (process.env.OAUTH_REDIRECT_BASE) return process.env.OAUTH_REDIRECT_BASE.replace(/\/$/, "");
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  return `${proto}://${host}`;
}

function redirectHome(res: Res, base: string, spaceId: string, err: string): void {
  res.statusCode = 302;
  res.setHeader("location", `${base}/#${spaceId}?error=${encodeURIComponent(err)}`);
  res.end();
}

// GET /api/oauth-start?provider=microsoft&id=<space>&category=<cat>
// 302 -> provider consent screen. State (nonce) is stored server-side for CSRF.
export default async function handler(req: Req, res: Res): Promise<void> {
  const q = query(req);
  const provider = q.get("provider") ?? "";
  const id = safeId(q.get("id"));
  const category = q.get("category") || "work";
  const base = baseUrl(req);

  if (!id) {
    res.statusCode = 400;
    res.end("missing ?id");
    return;
  }
  if (!isProvider(provider)) {
    redirectHome(res, base, id, "unknown_provider");
    return;
  }
  if (!isConfigured(provider)) {
    redirectHome(res, base, id, `${provider}_not_configured`);
    return;
  }

  const nonce = randomBytes(16).toString("hex");
  const redirectUri = `${base}/api/oauth-callback`;
  await kv().setex(
    `meridian:oauth:${nonce}`,
    600,
    JSON.stringify({ provider, spaceId: id, category, redirectUri }),
  );

  res.statusCode = 302;
  res.setHeader("location", authorizeUrl(provider, nonce, redirectUri));
  res.end();
}
