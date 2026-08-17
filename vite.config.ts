import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

// During `vite dev` there is no Vercel runtime, so mount every handler in
// ./api as connect middleware. Each file's default export is a (req, res)
// function using the same Node signature Vercel provides in production.
function apiDevPlugin(): Plugin {
  return {
    name: "meridian-api-dev",
    configureServer(server: ViteDevServer) {
      const apiDir = resolve(__dirname, "api");
      const routes = readdirSync(apiDir)
        .filter((f) => f.endsWith(".ts") && !f.startsWith("_"))
        .map((f) => "/" + f.replace(/\.ts$/, ""));

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const match = routes.find((r) => url === "/api" + r);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule("/api" + match + ".ts");
          await mod.default(req, res);
        } catch (err) {
          console.error("[api dev]", match, err);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
});
