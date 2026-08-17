import type { IncomingMessage, ServerResponse } from "node:http";

// Vercel Node functions and the Vite dev middleware both hand us the raw
// Node req/res, so these helpers work identically in both places.
export type Req = IncomingMessage & { body?: unknown };
export type Res = ServerResponse;

export function sendJson(res: Res, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

export async function readJson<T = any>(req: Req): Promise<T> {
  // Vercel pre-parses JSON bodies onto req.body; dev middleware does not.
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    return typeof req.body === "string" ? JSON.parse(req.body) : (req.body as T);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return (raw ? JSON.parse(raw) : {}) as T;
}

export function query(req: Req): URLSearchParams {
  const url = req.url ?? "";
  const qIndex = url.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : "");
}

/** Redis-key-safe slug for a calendar space id. */
export function safeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  return clean.length >= 1 ? clean : null;
}
