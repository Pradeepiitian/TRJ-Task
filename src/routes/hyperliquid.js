const express = require("express");
const hl = require("../clients/hyperliquid");
const { buildDailyPnl } = require("../lib/pnl");
const { parseDate, msRange } = require("../lib/dates");
const { isValidWallet } = require("../lib/validate");

const router = express.Router();
const MAX_DAYS = 90;

router.get("/:wallet/pnl", async (req, res) => {
  try {
    const wallet = (req.params?.wallet || "").toLowerCase();
    const start = req.query?.start;
    const end = req.query?.end;

    if (!isValidWallet(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    if (!parseDate(start) || !parseDate(end)) {
      return res.status(400).json({ error: "start and end must be YYYY-MM-DD" });
    }

    if (start > end) {
      return res.status(400).json({ error: "start must be <= end" });
    }

    const startDt = parseDate(start);
    const endDt = parseDate(end);
    const spanDays = (endDt - startDt) / (24 * 60 * 60 * 1000) + 1;

    if (spanDays > MAX_DAYS) {
      return res.status(400).json({ error: `Date range max ${MAX_DAYS} days` });
    }

    const role = await hl.getUserRole(wallet);
    if (role?.role === "missing") {
      return res.status(404).json({ error: "Wallet not found on HyperLiquid" });
    }

    const { startMs, endMs } = msRange(start, end);

    const [fills, fundingRows, state] = await Promise.all([
      hl.fetchAllFills(wallet, startMs, endMs),
      hl.fetchFunding(wallet, startMs, endMs),
      hl.getClearinghouseState(wallet).catch(() => null),
    ]);

    const initialEquity = parseFloat(
      state?.marginSummary?.accountValue ??
        state?.crossMarginSummary?.accountValue ??
        0
    );

    const { daily, summary } = await buildDailyPnl({
      start,
      end,
      fills,
      fundingRows,
      getCandleClose: (coin, ms) => hl.getCandleClose(coin, ms),
      initialEquity: Number.isFinite(initialEquity) ? initialEquity : 0,
    });

    res.json({
      wallet,
      start,
      end,
      daily,
      summary,
      diagnostics: {
        data_source: "hyperliquid_api",
        last_api_call: new Date().toISOString(),
        notes:
          "UTC calendar days. Realized/fees from fills; funding from userFunding; unrealized = daily change in MTM using 1d candle closes.",
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || "Internal error" });
  }
});

module.exports = router;
