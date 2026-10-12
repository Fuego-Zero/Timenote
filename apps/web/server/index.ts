import { fileURLToPath } from "node:url";

import type { createServer as createViteServer } from "vite";

import { createViteMiddleware } from "./createViteMiddleware.js";
import { createWebServer } from "./createWebServer.js";
import type { WebLogging } from "./types.js";

export type { WebLogging } from "./types.js";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function startWeb(
  apiUrl: string,
  port: number,
  built: boolean,
  options: { host: string; logging?: WebLogging }
) {
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  const server = createWebServer({
    apiUrl,
    root,
    built,
    port,
    getVite: () => vite,
    logging: options.logging,
  });
  if (!built) {
    vite = await createViteMiddleware({
      root,
      host: options.host,
      port,
      server,
    });
  }

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, options.host, resolveListen);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    port: actualPort,
    async close() {
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>(resolveClose => server.close(() => resolveClose()));
    },
  };
}
