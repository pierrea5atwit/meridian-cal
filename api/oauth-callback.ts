import { query, type Req, type Res } from "./_http.js";
import { kv } from "./_kv.js";
import { exchangeCode, fetchProviderEvents, isProvider, userEmail } from "./_oauth.js";
import { loadSpace, saveSpace, saveToken, type Connection, type Provider } from "./_store.js";

const PROVIDER_COLOR: Record<Provider, string> = {
  microsoft: "#2b6cb0",
  google: "#d9534f",
};

interface Pending {
  provider: Provider;
  spaceId: string;
  category: string;
  redirectUri: string;
}

function redirect(res: Res, url: string): void {
  res.statusCode = 302;
  res.setHeader("location", url);
  res.end();
}

// GET /api/oauth-callback?code=&state=  (registered redirect URI; no query in the
// registered value — providers append code/state themselves).
export default async function handler(req: Req, res: Res): Promise<void> {
  const q = query(req);
  const code = q.get("code");
  const state = q.get("state");
  const providerError = q.get("error");

  const home = (spaceId: string, params: string) =>
    redirect(res, `/#${spaceId}?${params}`);

  if (!state) {
    res.statusCode = 400;
    res.end("missing state");
    return;
  }

  // Consume the one-time state.
  const raw = await kv().get(`meridian:oauth:${state}`);
  await kv().set(`meridian:oauth:${state}`, "");
  if (!raw) {
    home("", "error=expired_state");
    return;
  }
  const pending = JSON.parse(raw) as Pending;

  if (providerError || !code) {
    home(pending.spaceId, `error=${encodeURIComponent(providerError || "no_code")}`);
    return;
  }
  if (!isProvider(pending.provider)) {
    home(pending.spaceId, "error=unknown_provider");
    return;
  }

  try {
    const tokens = await exchangeCode(pending.provider, code, pending.redirectUri);
    if (!tokens.refresh_token) {
      home(pending.spaceId, "error=no_refresh_token");
      return;
    }
    const email = await userEmail(pending.provider, tokens.access_token);

    const space = await loadSpace(pending.spaceId);
    // Reuse an existing connection for the same account, else create one.
    let conn = space.connections.find(
      (c) => c.provider === pending.provider && c.email === email,
    );
    if (!conn) {
      conn = {
        id: `conn-${Date.now().toString(36)}`,
        provider: pending.provider,
        email,
        color: PROVIDER_COLOR[pending.provider],
        category: pending.category,
        enabled: true,
        connectedAt: Date.now(),
      };
      space.connections.push(conn);
    } else {
      conn.enabled = true;
      conn.connectedAt = Date.now();
    }
    await saveToken(pending.spaceId, conn.id, {
      provider: pending.provider,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
    });
    await saveSpace(pending.spaceId, space);

    // Best-effort warm-up so the first render already has events (ignore errors).
    try {
      const now = Date.now();
      await fetchProviderEvents(pending.provider, tokens.access_token, new Date(now), new Date(now + 864e5));
    } catch {
      /* non-fatal */
    }

    home(pending.spaceId, `connected=${pending.provider}`);
  } catch (err) {
    home(pending.spaceId, `error=${encodeURIComponent(String(err).slice(0, 120))}`);
  }
}
