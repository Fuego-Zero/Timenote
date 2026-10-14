import type { LogSink } from "@timenote/runtime";

export interface WebLogging {
  env?: string;
  logSink?: LogSink;
}
