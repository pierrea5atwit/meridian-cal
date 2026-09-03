import { sendJson, query, safeId, type Req, type Res } from "./_http.js";
import { deleteToken, loadSpace, saveSpace } from "./_store.js";

// POST /api/disconnect?id=<space>&conn=<connId>
// Removes the connection and purges its refresh token.
export default async function handler(req: Req, res: Res): Promise<void> {
  const q = query(req);
  const id = safeId(q.get("id"));
  const connId = q.get("conn");
  if (!id || !connId) {
    sendJson(res, 400, { error: "missing id or conn" });
    return;
  }
  const space = await loadSpace(id);
  space.connections = space.connections.filter((c) => c.id !== connId);
  await saveSpace(id, space);
  await deleteToken(id, connId);
  sendJson(res, 200, { ok: true });
}
