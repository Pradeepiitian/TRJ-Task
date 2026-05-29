const express = require("express");
const coingecko = require("../clients/coingecko");
const ai = require("../clients/ai");

const router = express.Router();

router.post("/:id/insight", async (req, res) => {
  try {
    const id = req.params?.id;
    const vsCurrency = (req.body?.vs_currency || "usd").toLowerCase();
    const historyDays = Number(req.body?.history_days) || 30;

    const raw = await coingecko.getCoin(id);
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
      throw err;
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
