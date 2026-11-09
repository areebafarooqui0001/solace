// One place that talks to the language model, so the rest of the backend does not care which provider is used.
// Provider is chosen by AI_PROVIDER ("gemini" or "anthropic"), otherwise by whichever API key is present.
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

function pickProvider() {
  const want = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (want === 'gemini') return GEMINI_KEY ? 'gemini' : null;
  if (want === 'anthropic') return ANTHROPIC_KEY ? 'anthropic' : null;
  return ANTHROPIC_KEY ? 'anthropic' : GEMINI_KEY ? 'gemini' : null;
}

const provider = pickProvider();
if (process.env.AI_PROVIDER && !provider) {
  console.warn(`AI_PROVIDER=${process.env.AI_PROVIDER} but its API key is missing, using offline replies.`);
}

// ---- Anthropic (Claude) ----
const anthropic = provider === 'anthropic' ? new Anthropic() : null;
const CLAUDE_CHAT = process.env.CHAT_MODEL || 'claude-sonnet-5-5';
const CLAUDE_FAST = process.env.FAST_MODEL || 'claude-haiku-5-5';

async function callAnthropic({ system, messages, maxTokens, fast }) {
  const res = await anthropic.messages.create({
    model: fast ? CLAUDE_FAST : CLAUDE_CHAT,
    max_tokens: maxTokens,
    system,
    messages,
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// ---- Google Gemini (has a free tier) ----
const GEMINI_BASE = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
// Google retires Gemini models regularly, so each role has a list. If a model answers 404 (retired or not available
// to this key) the next one is tried, and the one that worked is remembered. Override with GEMINI_CHAT_MODEL /
// GEMINI_FAST_MODEL (a single name, or several separated by commas).
const list = (env, defaults) => (env ? env.split(',').map((m) => m.trim()).filter(Boolean) : defaults);
const GEMINI_MODELS = {
  chat: list(process.env.GEMINI_CHAT_MODEL, ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']),
  fast: list(process.env.GEMINI_FAST_MODEL, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite']),
};
const working = {}; // role -> model name that last succeeded

async function geminiRequest(model, { system, messages, maxTokens, json }) {
  const is25 = model.includes('2.5');
  // Thinking tokens count against maxOutputTokens and can cut the JSON off. 2.5 models take a budget of 0,
  // 3.x models take a thinking level; if a model rejects the setting we retry without it (with more headroom).
  const send = (thinking) =>
    fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: thinking ? maxTokens : maxTokens + 1500,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          ...(thinking ? { thinkingConfig: is25 ? { thinkingBudget: 0 } : { thinkingLevel: 'low' } } : {}),
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

  let res = await send(true);
  if (res.status === 400) res = await send(false);
  return res;
}

async function callGemini({ system, messages, maxTokens, fast, json }) {
  const role = fast ? 'fast' : 'chat';
  const candidates = [working[role], ...GEMINI_MODELS[role]].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastErr;
  for (const model of candidates) {
    const res = await geminiRequest(model, { system, messages, maxTokens, json });
    if (res.status === 404 || res.status === 403) {
      lastErr = new Error(`Gemini ${res.status} for ${model}: ${(await res.text()).slice(0, 160)}`);
      if (working[role] === model) delete working[role];
      continue; // retired or not available to this key: try the next model
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
    if (!text) {
      const why = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'unknown';
      throw new Error(`Gemini returned no text (${why})`);
    }
    if (working[role] !== model) {
      working[role] = model;
      console.log(`Gemini ${role} model: ${model}`);
    }
    return text;
  }
  throw lastErr || new Error('No Gemini model available');
}

/** Both APIs want turns that start with "user" and alternate. Merge repeats, drop a leading assistant turn. */
function normalize(messages) {
  const out = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n' + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/** Returns the model's text. `fast` picks the small/cheap model, `json` asks Gemini for JSON output. */
async function complete({ system, messages, maxTokens = 600, fast = false, json = false }) {
  const args = { system, messages: normalize(messages), maxTokens, fast, json };
  return provider === 'gemini' ? callGemini(args) : callAnthropic(args);
}

module.exports = { complete, provider, enabled: !!provider };
