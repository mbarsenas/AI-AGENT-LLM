#!/usr/bin/env node
import { loadEnv } from "./loadEnv.js";
import { askClaude } from "./clients/claude.js";
import { askOpenAI } from "./clients/openai.js";
import { askGrok } from "./clients/grok.js";

loadEnv();

const PROVIDERS = {
  claude: { label: "Claude", fn: askClaude, model: process.env.CLAUDE_MODEL, apiKey: process.env.ANTHROPIC_API_KEY },
  gpt: { label: "ChatGPT", fn: askOpenAI, model: process.env.OPENAI_MODEL, apiKey: process.env.OPENAI_API_KEY },
  grok: { label: "Grok", fn: askGrok, model: process.env.GROK_MODEL, apiKey: process.env.XAI_API_KEY },
};

function parseArgs(argv) {
  const args = { mode: "all", order: ["claude", "gpt", "grok"] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mode") args.mode = argv[++i];
    else if (arg === "--prompt" || arg === "-p") args.prompt = argv[++i];
    else if (arg === "--order") args.order = argv[++i].split(",").map((s) => s.trim());
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
llm-bridge — talk to Claude, ChatGPT, and Grok from one CLI

Usage:
  node src/index.js --prompt "your question" [--mode all|chain|synth] [--order claude,gpt,grok]

Modes:
  all     Send the same prompt to all three models in parallel, print each answer. (default)
  chain   Feed the answer from one model as the prompt to the next, in --order.
  synth   Like "all", but Claude then synthesizes the three answers into one.

Setup:
  Copy .env.example to .env and fill in whichever API keys you have.
  You don't need all three — llm-bridge skips providers with no key set.

Examples:
  node src/index.js --prompt "What's a good name for a coffee shop?"
  node src/index.js --prompt "Refine this pitch" --mode chain --order gpt,claude,grok
  node src/index.js --prompt "Explain quantum entanglement simply" --mode synth
`);
}

async function runAll(prompt, providers) {
  const results = await Promise.allSettled(
    providers.map(([key, p]) => p.fn(prompt, { apiKey: p.apiKey, ...(p.model ? { model: p.model } : {}) }))
  );

  results.forEach((result, i) => {
    const [, p] = providers[i];
    console.log(`\n=== ${p.label} ===`);
    if (result.status === "fulfilled") {
      console.log(result.value);
    } else {
      console.log(`(error: ${result.reason.message})`);
    }
  });

  return results;
}

async function runChain(prompt, order) {
  let current = prompt;
  for (const key of order) {
    const p = PROVIDERS[key];
    if (!p || !p.apiKey) {
      console.log(`\n(skipping ${key}: no API key set)`);
      continue;
    }
    console.log(`\n=== ${p.label} (input) ===\n${current}`);
    current = await p.fn(current, { apiKey: p.apiKey, ...(p.model ? { model: p.model } : {}) });
    console.log(`\n=== ${p.label} (output) ===\n${current}`);
  }
  return current;
}

async function runSynth(prompt, providers) {
  const results = await runAll(prompt, providers);

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
  const synthesis = await askClaude(
    `You were given the same prompt sent to three different AI models. Compare and synthesize their answers into one clear, useful response. Note any meaningful disagreements between them.\n\nOriginal prompt: ${prompt}\n\n${summaryInput}`,
    { apiKey: PROVIDERS.claude.apiKey, ...(PROVIDERS.claude.model ? { model: PROVIDERS.claude.model } : {}) }
  );
  console.log(synthesis);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.prompt) {
    printHelp();
    if (!args.help) process.exitCode = 1;
    return;
  }

  const activeProviders = Object.entries(PROVIDERS).filter(([, p]) => p.apiKey);
  if (activeProviders.length === 0) {
    console.error("No API keys found. Copy .env.example to .env and add at least one key.");
    process.exitCode = 1;
    return;
  }

  if (args.mode === "chain") {
    await runChain(args.prompt, args.order);
  } else if (args.mode === "synth") {
    await runSynth(args.prompt, activeProviders);
  } else {
    await runAll(args.prompt, activeProviders);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exitCode = 1;
});
