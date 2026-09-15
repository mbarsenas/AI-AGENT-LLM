# llm-bridge

Connect **Claude**, **ChatGPT**, **Grok**, and a **local Ollama model** from
one small CLI. Ask everything enabled the same question, chain them together,
or have Claude synthesize the answers into one. Zero dependencies — just
Node 18+'s built-in `fetch`.

[![Sponsor](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/mbarsenas)
[![Ko-fi](https://img.shields.io/badge/support-Ko--fi-ff5e5b?logo=ko-fi)](https://ko-fi.com/YOUR_KOFI_USERNAME)

## Setup

```bash
git clone https://github.com/mbarsenas/AI-AGENT-LLM.git
cd AI-AGENT-LLM
npm install
cp .env.example .env
```

Open `.env` and add whichever API keys you have — you don't need any of them
to get started, since the **local** provider (Ollama) needs no key or billing
and is enabled by default. Add cloud keys only for the providers you want.

| Provider | Env var             | Get a key from                                        |
|----------|----------------------|--------------------------------------------------------|
| Claude   | `ANTHROPIC_API_KEY`  | https://console.anthropic.com                          |
| ChatGPT  | `OPENAI_API_KEY`     | https://platform.openai.com                            |
| Grok     | `XAI_API_KEY`        | https://console.x.ai                                   |
| Local    | *(none needed)*      | Runs against Ollama at `localhost:11434` by default     |

To use the local provider, make sure [Ollama](https://ollama.com) is running
and has a model pulled (e.g. `ollama run llama3.2:3b`). If Ollama isn't
running, set `LOCAL_DISABLED=1` in `.env` to skip it instead of erroring.

## Usage

```bash
# Ask every enabled provider the same question, in parallel
# (works with zero API keys — the local Ollama model runs by default)
node src/index.js --prompt "What's a good name for a coffee shop?"

# Chain: feed each provider's answer into the next, in this order
node src/index.js --prompt "Refine this pitch" --mode chain --order gpt,claude,grok

# Ask everything enabled, then have Claude synthesize the answers into one
# (requires ANTHROPIC_API_KEY, since Claude is the synthesizer)
node src/index.js --prompt "Explain quantum entanglement simply" --mode synth
```

Run `node src/index.js --help` for the full option list.

## Troubleshooting

**Claude: "This API key is not scoped to a workspace..."**
Your key is an org-level key rather than one tied to a specific workspace.
Either create a new key scoped to a workspace (Console → Settings → API keys),
or keep your current key and set `ANTHROPIC_WORKSPACE_ID` in `.env` (find the
ID under Console → Settings → Workspaces).

**Grok: "Your newly created team doesn't have any credits or licenses yet."**
This is an xAI account/billing issue, not a code problem — the error links
directly to the page where you add credits.

**Local: connection refused / ECONNREFUSED on localhost:11434**
Ollama isn't running, or is running under a different alias/shortcut than
your terminal expects. Run `ollama list` to confirm a model is pulled, or
set `LOCAL_DISABLED=1` in `.env` to skip the local provider entirely.

## How it's structured

```
src/
  clients/
    claude.js              Anthropic Messages API
    openai.js               OpenAI Chat Completions API
    grok.js                 xAI Chat Completions API (OpenAI-compatible)
    local.js                Local Ollama server (OpenAI-compatible)
    openaiCompatible.js     shared helper used by openai.js, grok.js, and local.js
  loadEnv.js                tiny zero-dependency .env loader
  index.js                  CLI entry point (all / chain / synth modes)
```

Each client is a plain async function — `askClaude(prompt, opts)`,
`askOpenAI(prompt, opts)`, `askGrok(prompt, opts)`, `askLocal(prompt, opts)` —
so you can import them directly into your own project instead of using the CLI.

## Support this project

If llm-bridge is useful to you, consider supporting it — links are in the
badges above, and also show up automatically as a "Sponsor" button on this
repo's GitHub page (via `.github/FUNDING.yml`).

## License

MIT — see [LICENSE](LICENSE).
