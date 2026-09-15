// Runs automatically after `npm install`. Wrapped so it can never break
// the install itself, and can be silenced with LLM_BRIDGE_NO_DONATE=1.
try {
  if (!process.env.LLM_BRIDGE_NO_DONATE) {
    console.log(`
┌─────────────────────────────────────────────────────────┐
│  Thanks for installing llm-bridge!                       │
│                                                           │
│  Copy .env.example to .env, add your API keys, then:     │
│    node src/index.js --prompt "hello"                    │
│                                                           │
│  If this saved you time, consider supporting it:         │
│    https://github.com/sponsors/mbarsenas                 │
│    https://ko-fi.com/YOUR_KOFI_USERNAME                  │
│                                                           │
│  (set LLM_BRIDGE_NO_DONATE=1 to hide this message)       │
└─────────────────────────────────────────────────────────┘
`);
  }
} catch {
  // never fail the install over a console message
}
