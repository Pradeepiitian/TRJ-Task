const OpenAI = require("openai");
const config = require("../config");

let openaiClient;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openaiClient;
}

function buildPrompt(token, chartPoints) {
  const chartPart =
    chartPoints?.length > 0
      ? `Recent prices: ${JSON.stringify(chartPoints.slice(-7))}`
      : "";

  return `You are a crypto analyst. Reply with ONLY valid JSON, no markdown.
Schema: {"reasoning":"string","sentiment":"Bullish"|"Bearish"|"Neutral"}
Token: ${JSON.stringify(token)}
${chartPart}`;
}

function parseInsight(raw) {
  let text = (raw || "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(text);
  const allowed = ["Bullish", "Bearish", "Neutral"];

  if (typeof parsed?.reasoning !== "string" || !allowed.includes(parsed?.sentiment)) {
    throw new Error("Invalid insight shape");
  }

  return { reasoning: parsed.reasoning, sentiment: parsed.sentiment };
}

function openAiError(err) {
  const status = err?.status || 502;
  const code = err?.code || err?.error?.code;

  if (status === 429 || code === "insufficient_quota") {
    const e = new Error(
      "OpenAI rate limit or no quota (429). Check billing at platform.openai.com or use AI_PROVIDER=ollama."
    );
    e.status = 502;
    return e;
  }

  const e = new Error(err?.message || "OpenAI request failed");
  e.status = status >= 400 && status < 600 ? 502 : 502;
  return e;
}

async function callOpenAI(prompt) {
  if (!config.openaiApiKey) {
    const err = new Error("OPENAI_API_KEY not set in .env");
    err.status = 503;
    throw err;
  }

  const openai = getOpenAIClient();

  try {
    const result = await openai.responses.create({
      model: config.openaiModel,
      input: prompt,
      store: false,
    });

    const content = result?.output_text || "";

    return {
      insight: parseInsight(content),
      model: { provider: "openai", model: config.openaiModel },
    };
  } catch (err) {
    const useChatFallback =
      err?.status === 404 ||
      err?.code === "model_not_found" ||
      /model/i.test(err?.message || "");

    if (!useChatFallback) {
      throw openAiError(err);
    }

    try {
      const chat = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });
      const content = chat?.choices?.[0]?.message?.content || "";
      return {
        insight: parseInsight(content),
        model: { provider: "openai", model: "gpt-4o-mini" },
      };
    } catch (fallbackErr) {
      throw openAiError(fallbackErr);
    }
  }
}

async function callHuggingFace(prompt) {
  if (!config.hfApiKey || !config.hfModel) {
    const err = new Error("HF_API_KEY and HF_MODEL must be set");
    err.status = 503;
    throw err;
  }

  const url = `https://api-inference.huggingface.co/models/${config.hfModel}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.hfApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 400, return_full_text: false },
    }),
  });

  if (!res.ok) {
    const err = new Error(`Hugging Face error: ${res.status}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const text =
    Array.isArray(data) && data[0]?.generated_text
      ? data[0].generated_text
      : data?.generated_text || JSON.stringify(data);

  return {
    insight: parseInsight(text),
    model: { provider: "huggingface", model: config.hfModel },
  };
}

async function callOllama(prompt) {
  const res = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = new Error(`Ollama error: ${res.status}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const content = data?.message?.content;

  return {
    insight: parseInsight(content),
    model: { provider: "ollama", model: config.ollamaModel },
  };
}

async function getInsight(token, chartPoints) {
  const prompt = buildPrompt(token, chartPoints);
  const provider = config.aiProvider;

  if (provider === "huggingface" || provider === "hf") {
    return callHuggingFace(prompt);
  }
  if (provider === "ollama") {
    return callOllama(prompt);
  }
  return callOpenAI(prompt);
}

module.exports = { getInsight, buildPrompt, parseInsight };
