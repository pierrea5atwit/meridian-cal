import type { Provider } from "./_store.js";

export interface RawEvent {
  uid: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

interface ProviderCfg {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuth: Record<string, string>;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  userEmail: (accessToken: string) => Promise<string>;
  fetchEvents: (accessToken: string, from: Date, to: Date) => Promise<RawEvent[]>;
}

async function graphEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const j = await r.json();
  return j.mail || j.userPrincipalName || "outlook account";
}

async function graphEvents(accessToken: string, from: Date, to: Date): Promise<RawEvent[]> {
  // calendarView expands recurring series into instances within the window.
  const url =
    `https://graph.microsoft.com/v1.0/me/calendarView` +
    `?startDateTime=${encodeURIComponent(from.toISOString())}` +
    `&endDateTime=${encodeURIComponent(to.toISOString())}` +
    `&$select=subject,start,end,isAllDay,location&$top=250&$orderby=start/dateTime`;
  const r = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      // Ask Graph to return all times in UTC so we can parse deterministically.
      prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!r.ok) throw new Error(`Graph ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return (j.value ?? []).map((e: any): RawEvent => {
    // Graph returns e.g. "2026-09-07T00:00:00.0000000" with timeZone "UTC" (no Z).
    const toIso = (dt: string) => new Date(/Z$/.test(dt) ? dt : dt + "Z").toISOString();
    return {
      uid: e.id ?? `${e.subject}-${e.start?.dateTime}`,
      title: e.subject || "(untitled)",
      start: toIso(e.start.dateTime),
      end: toIso(e.end.dateTime),
      allDay: !!e.isAllDay,
      location: e.location?.displayName || undefined,
    };
  });
}

async function googleEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const j = await r.json();
  return j.email || "google account";
}

async function googleEvents(accessToken: string, from: Date, to: Date): Promise<RawEvent[]> {
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(from.toISOString())}` +
    `&timeMax=${encodeURIComponent(to.toISOString())}` +
    `&singleEvents=true&orderBy=startTime&maxResults=250`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return (j.items ?? []).map((e: any): RawEvent => {
    const allDay = !!e.start?.date;
    const start = e.start?.dateTime || e.start?.date;
    const end = e.end?.dateTime || e.end?.date;
    return {
      uid: e.id ?? `${e.summary}-${start}`,
      title: e.summary || "(untitled)",
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay,
      location: e.location || undefined,
    };
  });
}

const CONFIGS: Record<Provider, ProviderCfg> = {
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid email offline_access https://graph.microsoft.com/Calendars.Read",
    extraAuth: { response_mode: "query", prompt: "select_account" },
    clientId: () => process.env.MS_CLIENT_ID,
    clientSecret: () => process.env.MS_CLIENT_SECRET,
    userEmail: graphEmail,
    fetchEvents: graphEvents,
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
    extraAuth: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    userEmail: googleEmail,
    fetchEvents: googleEvents,
  },
};

export function isProvider(p: string): p is Provider {
  return p === "microsoft" || p === "google";
}

export function isConfigured(provider: Provider): boolean {
  const c = CONFIGS[provider];
  return !!c.clientId() && !!c.clientSecret();
}

export function authorizeUrl(provider: Provider, state: string, redirectUri: string): string {
  const c = CONFIGS[provider];
  const params = new URLSearchParams({
    client_id: c.clientId()!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: c.scope,
    state,
    ...c.extraAuth,
  });
  return `${c.authorizeUrl}?${params}`;
}

async function tokenRequest(provider: Provider, body: Record<string, string>): Promise<TokenResponse> {
  const c = CONFIGS[provider];
  const r = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId()!,
      client_secret: c.clientSecret()!,
      ...body,
    }),
  });
  const j = (await r.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    throw new Error(`token ${r.status}: ${j.error_description || j.error || "no access_token"}`);
  }
  return j;
}

export function exchangeCode(provider: Provider, code: string, redirectUri: string) {
  return tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(provider: Provider, refreshToken: string) {
  return tokenRequest(provider, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: CONFIGS[provider].scope,
  });
}

export function userEmail(provider: Provider, accessToken: string): Promise<string> {
  return CONFIGS[provider].userEmail(accessToken);
}

export function fetchProviderEvents(provider: Provider, accessToken: string, from: Date, to: Date) {
  return CONFIGS[provider].fetchEvents(accessToken, from, to);
}
