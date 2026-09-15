#!/usr/bin/env node
import { loadEnv } from "./loadEnv.js";
import { askClaude } from "./clients/claude.js";
import { askOpenAI } from "./clients/openai.js";
import { askGrok } from "./clients/grok.js";
import { askLocal } from "./clients/local.js";
import { speak } from "./speak.js";

loadEnv();

const PROVIDERS = {
  claude: {
    label: "Claude",
    fn: askClaude,
    model: process.env.CLAUDE_MODEL,
    apiKey: process.env.ANTHROPIC_API_KEY,
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID,
    enabled: Boolean(process.env.ANTHROPIC_API_KEY),
  },
  gpt: {
    label: "ChatGPT",
    fn: askOpenAI,
    model: process.env.OPENAI_MODEL,
    apiKey: process.env.OPENAI_API_KEY,
    enabled: Boolean(process.env.OPENAI_API_KEY),
  },
  grok: {
    label: "Grok",
    fn: askGrok,
    model: process.env.GROK_MODEL,
    apiKey: process.env.XAI_API_KEY,
    enabled: Boolean(process.env.XAI_API_KEY),
  },
  local: {
    label: "Local (Ollama)",
    fn: askLocal,
    model: process.env.LOCAL_MODEL,
    baseUrl: process.env.LOCAL_BASE_URL,
    // No paid key required — enabled by default, opt out with LOCAL_DISABLED=1
    enabled: process.env.LOCAL_DISABLED !== "1",
  },
};

function parseArgs(argv) {
  const args = { mode: "all", order: ["claude", "gpt", "grok"], rounds: 2, speak: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mode") args.mode = argv[++i];
    else if (arg === "--prompt" || arg === "-p") args.prompt = argv[++i];
    else if (arg === "--order") args.order = argv[++i].split(",").map((s) => s.trim());
    else if (arg === "--only") args.only = argv[++i].split(",").map((s) => s.trim());
    else if (arg === "--rounds") args.rounds = parseInt(argv[++i], 10);
    else if (arg === "--speak" || arg === "-s") args.speak = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
llm-bridge — talk to Claude, ChatGPT, Grok, and a local model from one CLI

Usage:
  node src/index.js --prompt "your topic" [--mode all|chain|synth|discuss] [--order claude,gpt,grok,local] [--only claude,gpt,grok,local] [--rounds N] [--speak]

Modes:
  all      Send the same prompt to every enabled provider in parallel, print each answer. (default)
  chain    Feed the answer from one provider as the prompt to the next, in --order.
  synth    Like "all", but Claude then synthesizes the answers into one (requires ANTHROPIC_API_KEY).
  discuss  Providers take turns discussing --prompt as a topic, each seeing what's been said
           so far, for --rounds full passes through --order (default 2 rounds).

Flags:
  --only    Restrict "all"/"synth" to just these providers (comma-separated), without touching .env.
            Handy when some providers are temporarily out of credit but you don't want to lose the keys.
  --rounds  Number of full passes through --order in "discuss" mode. Default: 2.
  --speak   Speak each answer out loud using OpenAI TTS (requires OPENAI_API_KEY).

Providers:
  claude, gpt, grok   Need an API key in .env (ANTHROPIC_API_KEY / OPENAI_API_KEY / XAI_API_KEY).
  local               Talks to a local Ollama server (default http://localhost:11434, model llama3.2:3b).
                      No key needed — enabled by default. Set LOCAL_DISABLED=1 to turn it off,
                      or LOCAL_MODEL / LOCAL_BASE_URL to point at a different model or port.

Examples:
  node src/index.js --prompt "What's a good name for a coffee shop?"
  node src/index.js --prompt "Refine this pitch" --mode chain --order gpt,claude,grok
  node src/index.js --prompt "Explain quantum entanglement simply" --mode synth
  node src/index.js --prompt "hello" --mode all
  node src/index.js --prompt "hello" --only gpt,local
  node src/index.js --prompt "Is remote work better than office work?" --mode discuss --order gpt,local --rounds 3
  node src/index.js --prompt "Tell me a short joke" --speak
`);
}

function callProvider(p, prompt, system) {
  const opts = {};
  if (p.apiKey) opts.apiKey = p.apiKey;
  if (p.model) opts.model = p.model;
  if (p.workspaceId) opts.workspaceId = p.workspaceId;
  if (p.baseUrl) opts.baseUrl = p.baseUrl;
  if (system) opts.system = system;
  return p.fn(prompt, opts);
}

async function maybeSpeak(text, shouldSpeak) {
  if (!shouldSpeak || !text?.trim()) return;
  if (!process.env.OPENAI_API_KEY) {
    console.error("(TTS skipped: OPENAI_API_KEY not set)");
    return;
  }
  try {
    console.log("(speaking…)");
    await speak(text, { apiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    console.error(`(TTS failed: ${err.message})`);
  }
}

async function runAll(prompt, providers, shouldSpeak) {
  const results = await Promise.allSettled(providers.map(([, p]) => callProvider(p, prompt)));

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const [, p] = providers[i];
    console.log(`\n=== ${p.label} ===`);
    if (result.status === "fulfilled") {
      console.log(result.value);
      await maybeSpeak(result.value, shouldSpeak);
    } else {
      console.log(`(error: ${result.reason.message})`);
    }
  }

  return results;
}

async function runChain(prompt, order, shouldSpeak) {
  let current = prompt;
  for (const key of order) {
    const p = PROVIDERS[key];
    if (!p || !p.enabled) {
      console.log(`\n(skipping ${key}: not enabled — no API key set, or explicitly disabled)`);
      continue;
    }
    console.log(`\n=== ${p.label} (input) ===\n${current}`);
    current = await callProvider(p, current);
    console.log(`\n=== ${p.label} (output) ===\n${current}`);
    await maybeSpeak(current, shouldSpeak);
  }
  return current;
}

async function runSynth(prompt, providers, shouldSpeak) {
  const results = await runAll(prompt, providers, shouldSpeak);

  const summaryInput = results
    .map((result, i) => {
      const [, p] = providers[i];
      const text = result.status === "fulfilled" ? result.value : `(error: ${result.reason.message})`;
      return `--- ${p.label} ---\n${text}`;
    })
    .join("\n\n");

  if (!PROVIDERS.claude.apiKey) {
    console.log("\n(synth step skipped: ANTHROPIC_API_KEY not set, Claude is used as the synthesizer)");
    return;
  }

  console.log("\n=== Synthesis (by Claude) ===");
  const synthesis = await callProvider(
    PROVIDERS.claude,
    `You were given the same prompt sent to three different AI models. Compare and synthesize their answers into one clear, useful response. Note any meaningful disagreements between them.\n\nOriginal prompt: ${prompt}\n\n${summaryInput}`
  );
  console.log(synthesis);
  await maybeSpeak(synthesis, shouldSpeak);
}

async function runDiscuss(topic, order, rounds, shouldSpeak) {
  const system =
    `You're one participant in a discussion among multiple AI models on this topic: "${topic}". ` +
    `You'll be shown what's been said so far. Respond naturally and specifically to the previous ` +
    `points — agree, disagree, or add a new angle. Keep it conversational: a short paragraph or two, ` +
    `not a full essay, and don't just restate what's already been said.`;

  const transcript = [];
  for (let round = 1; round <= rounds; round++) {
    for (const key of order) {
      const p = PROVIDERS[key];
      if (!p || !p.enabled) {
        console.log(`\n(skipping ${key}: not enabled — no API key set, or explicitly disabled)`);
        continue;
      }

      const context = transcript.length
        ? transcript.map((t) => `${t.label}: ${t.text}`).join("\n\n")
        : "(no one has spoken yet — you're opening the discussion)";

      const prompt = `Topic: ${topic}\n\nConversation so far:\n${context}\n\nYour turn:`;

      console.log(`\n=== Round ${round} — ${p.label} ===`);
      const text = await callProvider(p, prompt, system);
      console.log(text);
      await maybeSpeak(text, shouldSpeak);

      transcript.push({ label: p.label, text });
    }
  }
  return transcript;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.prompt) {
    printHelp();
    if (!args.help) process.exitCode = 1;
    return;
  }

  let activeProviders = Object.entries(PROVIDERS).filter(([, p]) => p.enabled);
  if (args.only) {
    activeProviders = activeProviders.filter(([key]) => args.only.includes(key));
  }

  if (activeProviders.length === 0) {
    console.error("No providers available. Add an API key to .env, unset LOCAL_DISABLED, or check your --only list.");
    process.exitCode = 1;
    return;
  }

  if (args.mode === "chain") {
    await runChain(args.prompt, args.order, args.speak);
  } else if (args.mode === "synth") {
    await runSynth(args.prompt, activeProviders, args.speak);
  } else if (args.mode === "discuss") {
    await runDiscuss(args.prompt, args.order, args.rounds, args.speak);
  } else {
    await runAll(args.prompt, activeProviders, args.speak);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exitCode = 1;
});