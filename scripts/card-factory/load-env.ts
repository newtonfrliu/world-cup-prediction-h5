import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const root = process.cwd();

export const attemptedEnvPaths = [
  path.join(root, ".env.local"),
  path.join(root, ".env"),
];

for (const envPath of attemptedEnvPaths) {
  if (existsSync(envPath)) {
    dotenv.config({
      path: envPath,
      override: false,
    });
  }
}

export function formatAttemptedEnvPaths() {
  return attemptedEnvPaths.join(", ");
}
