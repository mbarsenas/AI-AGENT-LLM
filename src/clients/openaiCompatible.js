/**
 * Shared client for any OpenAI-compatible chat completions API.
 * Both OpenAI and xAI (Grok) speak this schema, so this one function
 * powers both of the thin wrappers in this folder.
 */
export async function askOpenAICompatible(prompt, { apiKey, baseUrl, model, system } = {}) {
  if (!apiKey) throw new Error("Missing API key");
  if (!baseUrl) throw new Error("Missing baseUrl");
  if (!model) throw new Error("Missing model");

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status} from ${baseUrl}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
