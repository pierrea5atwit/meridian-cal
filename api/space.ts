import { readJson, sendJson, query, safeId, type Req, type Res } from "./_http.js";
import { loadSpace, saveSpace, type CalendarSpace } from "./_store.js";

// GET  /api/space?id=<slug>  -> current space (feeds config + personal events)
// PUT  /api/space?id=<slug>  -> replace the whole space, returns the saved copy
export default async function handler(req: Req, res: Res): Promise<void> {
  const id = safeId(query(req).get("id"));
  if (!id) {
    sendJson(res, 400, { error: "missing or invalid ?id" });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, await loadSpace(id));
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    let incoming: CalendarSpace;
    try {
      incoming = await readJson<CalendarSpace>(req);
    } catch {
      sendJson(res, 400, { error: "invalid JSON body" });
      return;
    }
    const saved = await saveSpace(id, {
      feeds: Array.isArray(incoming.feeds) ? incoming.feeds : [],
      events: Array.isArray(incoming.events) ? incoming.events : [],
      categories: Array.isArray(incoming.categories) ? incoming.categories : [],
      updatedAt: 0,
    });
    sendJson(res, 200, saved);
    return;
  }

  sendJson(res, 405, { error: "method not allowed" });
}
