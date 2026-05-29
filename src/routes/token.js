const express = require("express");
const coingecko = require("../clients/coingecko");
const ai = require("../clients/ai");

const router = express.Router();

router.post("/:id/insight", async (req, res) => {
  try {
    const id = (req.params?.id || "").trim().toLowerCase();
    if (!id) {
      return res.status(400).json({ error: "Token id is required" });
    }

    const vsCurrency = (req.body?.vs_currency || "usd").toLowerCase();
    let historyDays = Number(req.body?.history_days);
    if (!Number.isFinite(historyDays) || historyDays < 1) {
      historyDays = 30;
    }
    if (historyDays > 365) {
      historyDays = 365;
    }

    let raw;
    try {
      raw = await coingecko.getCoin(id);
    } catch (err) {
      return res.status(err?.status || 502).json({
        error: err?.message || "CoinGecko request failed",
      });
    }

    const token = coingecko.normalizeToken(raw, vsCurrency);

    let chartPoints = [];
    try {
      const chart = await coingecko.getMarketChart(id, vsCurrency, historyDays);
      chartPoints = chart?.prices || [];
    } catch {
      chartPoints = [];
    }

    let insight;
    let model;

    try {
      const result = await ai.getInsight(token, chartPoints);
      insight = result.insight;
      model = result.model;
    } catch (err) {
      if (err?.message === "Invalid insight shape") {
        return res.status(502).json({ error: "AI returned invalid JSON" });
      }
      return res.status(err?.status || 502).json({
        error: err?.message || "AI request failed",
      });
    }

    res.json({
      source: "coingecko",
      token,
      insight,
      model,
    });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || "Internal error" });
  }
});

module.exports = router;
