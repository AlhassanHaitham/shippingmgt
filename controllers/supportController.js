import { askAssistant, isAiConfigured } from "../services/ai.js";

// AI support chat. Grounded in Iraqi logistics regulations via services/ai.js.
// Conversation memory lives on the session, capped to recent turns to bound cost.
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 8; // user+assistant pairs kept for context

// Support page (OpenRouter-backed AI chat UI).
export function page(req, res) {
  res.render("support");
}

export async function chat(req, res) {
  const message =
    req.body && typeof req.body.message === "string"
      ? req.body.message.trim()
      : "";

  if (!message) {
    return res.status(400).json({ reply: "Please type a message first." });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({
      reply: `That message is too long (max ${MAX_MESSAGE_CHARS} characters). Please shorten it.`,
    });
  }

  // No key configured → friendly fallback so the app stays usable.
  if (!isAiConfigured()) {
    return res.json({
      reply:
        "AI is not configured yet. Set OPENROUTER_API_KEY in .env to enable the assistant.",
      sources: [],
    });
  }

  const history = Array.isArray(req.session.chatHistory)
    ? req.session.chatHistory
    : [];

  try {
    const { reply, sources } = await askAssistant({
      message,
      history,
      lang: res.locals.lang,
    });

    // Record this turn and keep only the most recent turns (OpenAI message format).
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });
    req.session.chatHistory = history.slice(-MAX_HISTORY_TURNS * 2);

    return res.json({ reply, sources });
  } catch (err) {
    console.error("/api/chat error:", err);
    const t = res.locals.t || {};
    const rateLimited = err.code === "AI_RATE_LIMITED" || err.status === 429;
    return res.status(rateLimited ? 429 : 502).json({
      reply: rateLimited
        ? t.ai_busy ||
          "The assistant is busy right now (free-tier limit). Please wait a moment and try again."
        : t.ai_error ||
          "Sorry, I hit a problem reaching the assistant. Please try again.",
      sources: [],
    });
  }
}

// Clear the conversation memory ("new chat").
export function reset(req, res) {
  req.session.chatHistory = [];
  res.json({ ok: true });
}
