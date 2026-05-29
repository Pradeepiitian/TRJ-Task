const config = require("../config");

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

async function callOpenAI(prompt) {
  if (!config.openaiApiKey) {
    const err = new Error("OPENAI_API_KEY not set");
    err.status = 503;
    throw err;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = new Error(`OpenAI error: ${res.status}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  return {
    insight: parseInsight(content),
    model: { provider: "openai", model: config.openaiModel },
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

  if (config.aiProvider === "ollama") {
    return callOllama(prompt);
  }

  return callOpenAI(prompt);
}

module.exports = { getInsight, buildPrompt, parseInsight };
