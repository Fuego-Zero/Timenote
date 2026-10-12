import { createServer as createHttpServer, type Server } from "node:http";

import type { ViteDevServer } from "vite";

import { dispatchWebRequest } from "./dispatchWebRequest.js";
import type { WebLogging } from "./types.js";

export function createWebServer(input: {
  apiUrl: string;
  root: string;
  built: boolean;
  port: number;
  getVite: () => ViteDevServer | undefined;
  logging?: WebLogging;
}): Server {
  return createHttpServer((req, res) => {
    void dispatchWebRequest(req, res, {
      apiUrl: input.apiUrl,
      root: input.root,
      built: input.built,
      port: input.port,
      vite: input.getVite(),
      logging: input.logging,
    }).catch(() => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }

      res.end('{"code":"INTERNAL_ERROR","message":"请求失败"}');
    });
  });
}
