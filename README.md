# llm-bridge

Connect **Claude**, **ChatGPT**, and **Grok** from one small CLI. Ask all three
the same question, chain them together, or have Claude synthesize their
answers into one. Zero dependencies — just Node 18+'s built-in `fetch`.

[![Sponsor](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/mbarsenas)
[![Ko-fi](https://img.shields.io/badge/support-Ko--fi-ff5e5b?logo=ko-fi)](https://ko-fi.com/YOUR_KOFI_USERNAME)

## Setup

```bash
git clone https://github.com/mbarsenas/AI-AGENT-LLM.git
cd AI-AGENT-LLM
npm install
cp .env.example .env
```

Open `.env` and add whichever API keys you have — you don't need all three,
llm-bridge just skips any provider with no key set.

| Provider | Env var             | Get a key from                                      |
|----------|----------------------|------------------------------------------------------|
| Claude   | `ANTHROPIC_API_KEY`  | https://console.anthropic.com                        |
| ChatGPT  | `OPENAI_API_KEY`     | https://platform.openai.com                          |
| Grok     | `XAI_API_KEY`        | https://console.x.ai                                 |

## Usage

```bash
# Ask all configured models the same question, in parallel
node src/index.js --prompt "What's a good name for a coffee shop?"

# Chain: feed each model's answer into the next, in this order
node src/index.js --prompt "Refine this pitch" --mode chain --order gpt,claude,grok

# Ask all three, then have Claude synthesize the answers into one
node src/index.js --prompt "Explain quantum entanglement simply" --mode synth
```

Run `node src/index.js --help` for the full option list.

## How it's structured

```
src/
  clients/
    claude.js              Anthropic Messages API
    openai.js               OpenAI Chat Completions API
    grok.js                 xAI Chat Completions API (OpenAI-compatible)
    openaiCompatible.js     shared helper used by openai.js and grok.js
  loadEnv.js                tiny zero-dependency .env loader
  index.js                  CLI entry point (all / chain / synth modes)
```

Each client is a plain async function — `askClaude(prompt, opts)`,
`askOpenAI(prompt, opts)`, `askGrok(prompt, opts)` — so you can import them
directly into your own project instead of using the CLI.

## Support this project

If llm-bridge is useful to you, consider supporting it — links are in the
badges above, and also show up automatically as a "Sponsor" button on this
repo's GitHub page (via `.github/FUNDING.yml`).

## License

MIT — see [LICENSE](LICENSE).
