require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT) || 3000,
  coingeckoBaseUrl:
    process.env.COINGECKO_BASE_URL || "https://api.coingecko.com/api/v3",
  hyperliquidInfoUrl:
    process.env.HYPERLIQUID_INFO_URL || "https://api.hyperliquid.xyz/info",
  aiProvider: (process.env.AI_PROVIDER || "openai").toLowerCase(),
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  aiFallbackOnQuota: process.env.AI_FALLBACK_ON_QUOTA !== "false",
  hfApiKey: process.env.HF_API_KEY,
  hfModel: process.env.HF_MODEL,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
};
