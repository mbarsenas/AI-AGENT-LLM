import { askOpenAICompatible } from "./openaiCompatible.js";

/**
 * Client for a locally-running Ollama server.
 * Ollama exposes an OpenAI-compatible endpoint at /v1/chat/completions
 * and doesn't require a real API key — any non-empty string works.
 * Docs: https://github.com/ollama/ollama/blob/main/docs/openai.md
 */
export function askLocal(prompt, { apiKey = "ollama-local", baseUrl = "http://localhost:11434/v1", model = "llama3.2:3b", system } = {}) {
  return askOpenAICompatible(prompt, { apiKey, baseUrl, model, system });
}
