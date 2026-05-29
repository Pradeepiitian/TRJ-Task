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

function isQuotaError(err) {
  const status = err?.status;
  const code = err?.code || err?.error?.code;
  return status === 429 || code === "insufficient_quota";
}

function rulesInsightFromToken(token) {
  const name = token?.name || token?.id || "Token";
  const symbol = (token?.symbol || "").toUpperCase();
  const price = token?.market_data?.current_price_usd;
  const change = token?.market_data?.price_change_percentage_24h ?? 0;
  const volume = token?.market_data?.total_volume_usd;
  const cap = token?.market_data?.market_cap_usd;

  let sentiment = "Neutral";
  if (change > 2) {
    sentiment = "Bullish";
  } else if (change < -2) {
    sentiment = "Bearish";
  }

  const reasoning =
    `${name} (${symbol}) trades around $${price ?? "n/a"} with a 24h change of ` +
    `${change?.toFixed?.(2) ?? change}%. Market cap is $${cap ?? "n/a"} and 24h volume is ` +
    `$${volume ?? "n/a"}. Short-term tone looks ${sentiment.toLowerCase()} based on recent price action.`;

  return { reasoning, sentiment };
}

function openAiError(err) {
  if (isQuotaError(err)) {
    const e = new Error(
      "OpenAI rate limit or no quota (429). Add billing at platform.openai.com, install Ollama (AI_PROVIDER=ollama), or set AI_FALLBACK_ON_QUOTA=true."
    );
    e.status = 502;
    e.isQuota = true;
    return e;
  }

  const e = new Error(err?.message || "OpenAI request failed");
  e.status = 502;
  return e;
}

async function callOpenAI(prompt, token) {
  if (!config.openaiApiKey) {
    const err = new Error("OPENAI_API_KEY not set in .env");
    err.status = 503;
    throw err;
  }

  const openai = getOpenAIClient();

  const tryModels = [
    config.openaiModel,
    "gpt-4o-mini",
    "gpt-4o",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastErr;

  for (const model of tryModels) {
    try {
      const result = await openai.responses.create({
        model,
        input: prompt,
        store: false,
      });

      const content = result?.output_text || "";

      return {
        insight: parseInsight(content),
        model: { provider: "openai", model },
      };
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err)) {
        break;
      }
    }
  }

  if (!lastErr || !isQuotaError(lastErr)) {
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
    } catch (chatErr) {
      lastErr = chatErr;
    }
  }

  if (config.aiFallbackOnQuota && token) {
    return {
      insight: rulesInsightFromToken(token),
      model: {
        provider: "local-fallback",
        model: "market-data-rules",
      },
    };
  }

  throw openAiError(lastErr);
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
  return callOpenAI(prompt, token);
}

module.exports = {
  getInsight,
  buildPrompt,
  parseInsight,
  rulesInsightFromToken,
};
