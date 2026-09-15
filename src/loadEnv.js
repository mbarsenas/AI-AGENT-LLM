import { readFileSync, existsSync } from "node:fs";

/**
 * Minimal .env loader so this project needs zero dependencies.
 * Reads KEY=VALUE lines from a .env file in the project root and
 * applies them to process.env if not already set.
 */
export function loadEnv(path = ".env") {
  if (!existsSync(path)) return;

  const contents = readFileSync(path, "utf-8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
