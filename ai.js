// AI assistant for the /support chat — backed by OpenRouter.
//
// We originally targeted Google Gemini directly, but that Google account/project
// was flagged ("project has been denied access", 403 PERMISSION_DENIED — an
// anti-abuse flag, most likely from a leaked key committed to this repo). OpenRouter
// is an OpenAI-compatible gateway to many models, reachable from Iraq, so it
// sidesteps that account entirely. Only this file changed providers.
//
// The model answers as a ShipFlow logistics assistant grounded in Iraqi
// regulations and laws. Optional live web search (OPENROUTER_WEB_SEARCH=true)
// adds real source citations. Key lives in .env (OPENROUTER_API_KEY).

// Default is OpenRouter, but any OpenAI-compatible endpoint works (e.g. Groq:
// https://api.groq.com/openai/v1/chat/completions) by setting OPENROUTER_BASE_URL.
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 45000;

export function isAiConfigured() {
  return !!process.env.OPENROUTER_API_KEY;
}

const LANG_NAMES = {
  en: "English",
  ar: "Arabic (العربية)",
  ku: "Kurdish — Sorani (کوردی سۆرانی)",
};

// Language-aware fallback for the rare empty completion (e.g. a safety stop).
const EMPTY_REPLY = {
  en: "I couldn't generate an answer for that. Please try rephrasing your question.",
  ar: "لم أتمكن من إنشاء إجابة لهذا السؤال. يرجى إعادة صياغة سؤالك.",
  ku: "نەمتوانی وەڵامێک بۆ ئەوە دروست بکەم. تکایە پرسیارەکەت بە شێوەیەکی تر بنووسەرەوە.",
};

function buildSystemPrompt(lang) {
  const langName = LANG_NAMES[lang] || LANG_NAMES.en;
  return `You are "ShipFlow Assistant", an AI assistant embedded in a shipping and
logistics management system used by companies that operate in Iraq.

# Your role
Help users with shipping, freight, courier and delivery operations, customs
clearance, import/export, road and commercial transport, warehousing, shipping
documentation, and the Iraqi laws and regulations that govern these activities.

# Grounding in Iraqi law — this is critical
- Users need answers that are correct under **Iraqi regulations and laws**.
- When web search results are included in the conversation, base your answer on
  them and reference those sources. Prefer official Iraqi government sources.
- NEVER invent specifics. Do not fabricate law or article numbers, exact fees,
  fines, tariff rates, or the names of agencies or forms. If you are not certain,
  say so plainly rather than guessing.
- For anything that needs a binding or official answer, tell the user to confirm
  with the relevant authority — e.g. the General Commission for Customs
  (الهيئة العامة للكمارك), the Ministry of Transport (وزارة النقل), or the Ministry
  of Trade (وزارة التجارة).
- Whenever you give legal or customs specifics, add a brief note that this is
  general guidance, not official legal advice.

# Scope
Stay on logistics, shipping, transport, trade, and the related Iraqi rules. If a
user asks something clearly unrelated (entertainment, coding help, personal advice,
etc.), briefly and politely steer them back to what you can help with.

# Language and style
Reply in ${langName}. If the user clearly writes in another language, match their
language instead. Keep answers concise, practical, and well structured — short
paragraphs or bullet points, simple professional wording.`;
}

// OpenRouter (OpenAI format) surfaces web citations on message.annotations.
function extractSources(message) {
  const annotations = message?.annotations || [];
  const seen = new Set();
  const sources = [];
  for (const a of annotations) {
    if (a?.type !== "url_citation") continue;
    const c = a.url_citation;
    if (!c?.url || seen.has(c.url)) continue;
    seen.add(c.url);
    sources.push({ title: c.title || c.url, uri: c.url });
  }
  return sources;
}

/**
 * Ask the assistant a question.
 * @param {object} opts
 * @param {string} opts.message  the user's latest message
 * @param {Array}  opts.history  prior turns as [{ role:'user'|'assistant', content:string }]
 * @param {string} opts.lang     UI language: 'en' | 'ar' | 'ku'
 * @returns {Promise<{reply: string, sources: Array<{title,uri}>}>}
 */
export async function askAssistant({ message, history = [], lang = "en" }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENROUTER_API_KEY is not configured");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }

  const model =
    process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const webSearch =
    String(process.env.OPENROUTER_WEB_SEARCH || "false").toLowerCase() === "true";

  const body = {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt(lang) },
      ...history,
      { role: "user", content: message },
    ],
    temperature: 0.4,
  };
  // Live web grounding → real source citations (costs a few cents per request).
  if (webSearch) {
    body.plugins = [{ id: "web", max_results: 5 }];
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Optional ranking headers; also identify the app to OpenRouter.
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "ShipFlow Assistant",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`OpenRouter HTTP ${resp.status}: ${text.slice(0, 500)}`);
    // 429 = free-tier/provider rate limit; surfaced to users as a "busy" message.
    err.code = resp.status === 429 ? "AI_RATE_LIMITED" : "AI_HTTP_ERROR";
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  // OpenRouter can return an error envelope with a 200 status.
  if (data.error) {
    const status = data.error.code;
    const err = new Error(
      `OpenRouter error: ${JSON.stringify(data.error).slice(0, 500)}`,
    );
    err.code = status === 429 ? "AI_RATE_LIMITED" : "AI_API_ERROR";
    err.status = status;
    throw err;
  }

  const msg = data.choices?.[0]?.message;
  const reply = (msg?.content || "").trim() || EMPTY_REPLY[lang] || EMPTY_REPLY.en;
  return { reply, sources: extractSources(msg) };
}
