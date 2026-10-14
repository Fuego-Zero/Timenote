import { existsSync } from "node:fs";

/** Fill missing keys from a dotenv file. Already-set process env wins. */
export function loadDotenv(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const previous = { ...process.env };
  process.loadEnvFile(path);
  Object.assign(process.env, previous);
}
