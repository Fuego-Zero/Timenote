import type { Server } from "node:http";
import { resolve } from "node:path";

import type { createServer as createViteServer } from "vite";

export async function createViteMiddleware(input: {
  root: string;
  host: string;
  port: number;
  server: Server;
}): Promise<Awaited<ReturnType<typeof createViteServer>>> {
  // Production uses --built and does not install Vite.
  // eslint-disable-next-line import-x/no-extraneous-dependencies
  const { createServer: createViteServer } = await import("vite");
  return createViteServer({
    root: input.root,
    configFile: resolve(input.root, "vite.config.ts"),
    appType: "custom",
    server: {
      middlewareMode: true,
      host: input.host === "127.0.0.1" || input.host === "localhost" ? input.host : true,
      ws: { server: input.server, clientPort: input.port },
      hmr: { overlay: false },
      forwardConsole: false,
    },
  });
}
