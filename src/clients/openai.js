import { askOpenAICompatible } from "./openaiCompatible.js";

/**
 * Client for OpenAI's Chat Completions API (ChatGPT).
 * Docs: https://platform.openai.com/docs/api-reference/chat
 */
export function askOpenAI(prompt, { apiKey, model = "gpt-4o", system } = {}) {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return askOpenAICompatible(prompt, {
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    model,
    system,
  });
}
