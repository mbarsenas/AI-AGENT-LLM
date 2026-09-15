import { askOpenAICompatible } from "./openaiCompatible.js";

/**
 * Client for xAI's Chat Completions API (Grok).
 * Docs: https://docs.x.ai/api
 * xAI's endpoint is OpenAI-compatible, so this reuses the same request shape.
 */
export function askGrok(prompt, { apiKey, model = "grok-4", system } = {}) {
  if (!apiKey) throw new Error("Missing XAI_API_KEY");
  return askOpenAICompatible(prompt, {
    apiKey,
    baseUrl: "https://api.x.ai/v1",
    model,
    system,
  });
}
