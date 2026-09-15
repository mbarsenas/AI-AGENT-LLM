import { loadEnv } from "./loadEnv.js";
import { askClaude } from "./clients/claude.js";
import { askOpenAI } from "./clients/openai.js";
import { askGrok } from "./clients/grok.js";
import { askLocal } from "./clients/local.js";

loadEnv();

const providerDefinitions = {
  claude: { label: "Claude", fn: askClaude, modelEnv: "CLAUDE_MODEL", apiKeyEnv: "ANTHROPIC_API_KEY", workspaceIdEnv: "ANTHROPIC_WORKSPACE_ID" },
  gpt: { label: "ChatGPT", fn: askOpenAI, modelEnv: "OPENAI_MODEL", apiKeyEnv: "OPENAI_API_KEY" },
  grok: { label: "Grok", fn: askGrok, modelEnv: "GROK_MODEL", apiKeyEnv: "XAI_API_KEY" },
  local: { label: "Local (Ollama)", fn: askLocal, modelEnv: "LOCAL_MODEL", baseUrlEnv: "LOCAL_BASE_URL", local: true },
};

function providerConfig(key) {
  const definition = providerDefinitions[key];
  if (!definition) return null;
  const apiKey = definition.apiKeyEnv ? process.env[definition.apiKeyEnv] : undefined;
  return {
    key,
    label: definition.label,
    fn: definition.fn,
    model: definition.modelEnv ? process.env[definition.modelEnv] : undefined,
    apiKey,
    workspaceId: definition.workspaceIdEnv ? process.env[definition.workspaceIdEnv] : undefined,
    baseUrl: definition.baseUrlEnv ? process.env[definition.baseUrlEnv] : undefined,
    local: Boolean(definition.local),
    enabled: definition.local ? process.env.LOCAL_DISABLED !== "1" : Boolean(apiKey),
  };
}

export function getProviders({ includeLocal = true } = {}) {
  return Object.keys(providerDefinitions)
    .map(providerConfig)
    .filter(Boolean)
    .filter((provider) => includeLocal || !provider.local)
    .map(({ key, label, model, local, enabled }) => ({ key, label, model, local, enabled }));
}

function resolveProvider(key, { includeLocal = true } = {}) {
  const provider = providerConfig(key);
  if (!provider) throw new Error(`Unknown provider: ${key}`);
  if (provider.local && !includeLocal) throw new Error("The local Ollama provider is not available in this runtime.");
  if (!provider.enabled) throw new Error(`Provider ${key} is not enabled.`);
  return provider;
}

async function callProvider(provider, prompt, system) {
  const opts = {};
  if (provider.apiKey) opts.apiKey = provider.apiKey;
  if (provider.model) opts.model = provider.model;
  if (provider.workspaceId) opts.workspaceId = provider.workspaceId;
  if (provider.baseUrl) opts.baseUrl = provider.baseUrl;
  if (system) opts.system = system;
  return provider.fn(prompt, opts);
}

export async function ask({ provider, prompt, system, includeLocal = true }) {
  if (!prompt?.trim()) throw new Error("prompt is required");
  const selected = resolveProvider(provider, { includeLocal });
  const text = await callProvider(selected, prompt, system);
  return { provider: selected.key, label: selected.label, text };
}

export async function askAll({ prompt, providers, system, includeLocal = true }) {
  if (!prompt?.trim()) throw new Error("prompt is required");
  const keys = providers?.length ? providers : getProviders({ includeLocal }).filter((p) => p.enabled).map((p) => p.key);
  if (!keys.length) throw new Error("No providers are enabled.");
  const selected = keys.map((key) => resolveProvider(key, { includeLocal }));
  const settled = await Promise.allSettled(selected.map((p) => callProvider(p, prompt, system)));
  return settled.map((result, index) => ({
    provider: selected[index].key,
    label: selected[index].label,
    ok: result.status === "fulfilled",
    ...(result.status === "fulfilled" ? { text: result.value } : { error: result.reason?.message ?? String(result.reason) }),
  }));
}

export async function chain({ prompt, order = ["gpt", "claude", "grok"], includeLocal = true }) {
  if (!prompt?.trim()) throw new Error("prompt is required");
  let current = prompt;
  const steps = [];
  for (const key of order) {
    const provider = resolveProvider(key, { includeLocal });
    const input = current;
    current = await callProvider(provider, current);
    steps.push({ provider: key, label: provider.label, input, text: current });
  }
  return { text: current, steps };
}

export async function synthesize({ prompt, providers, synthesizer = "claude", includeLocal = true }) {
  const results = await askAll({ prompt, providers, includeLocal });
  if (!results.some((result) => result.ok)) throw new Error("No provider returned a successful response.");
  const summaryInput = results.map((result) => `--- ${result.label} ---\n${result.ok ? result.text : `(error: ${result.error})`}`).join("\n\n");
  const synthesisProvider = resolveProvider(synthesizer, { includeLocal });
  const synthesisPrompt = `You were given the same prompt sent to multiple AI models. Compare and synthesize their answers into one clear, useful response. Note meaningful disagreements when they matter.\n\nOriginal prompt: ${prompt}\n\n${summaryInput}`;
  const text = await callProvider(synthesisProvider, synthesisPrompt);
  return { text, synthesizer, label: synthesisProvider.label, results };
}

export async function discuss({ prompt, order = ["gpt", "claude", "grok"], rounds = 2, includeLocal = true }) {
  if (!prompt?.trim()) throw new Error("prompt is required");
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) throw new Error("rounds must be an integer from 1 to 10");
  const system = `You're one participant in a discussion among multiple AI models on this topic: "${prompt}". You'll be shown what's been said so far. Respond naturally and specifically to previous points. Agree, disagree, or add a new angle. Keep it concise and don't merely restate prior responses.`;
  const transcript = [];
  for (let round = 1; round <= rounds; round++) {
    for (const key of order) {
      const provider = resolveProvider(key, { includeLocal });
      const context = transcript.length ? transcript.map((entry) => `${entry.label}: ${entry.text}`).join("\n\n") : "(no one has spoken yet — you're opening the discussion)";
      const turnPrompt = `Topic: ${prompt}\n\nConversation so far:\n${context}\n\nYour turn:`;
      const text = await callProvider(provider, turnPrompt, system);
      transcript.push({ round, provider: key, label: provider.label, text });
    }
  }
  return { topic: prompt, rounds, transcript };
}
