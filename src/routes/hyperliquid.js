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

    let role;
    try {
      role = await hl.getUserRole(wallet);
    } catch (err) {
      return res.status(err?.status || 502).json({
        error: err?.message || "HyperLiquid API error",
      });
    }

    if (role?.role === "missing") {
      return res.status(404).json({ error: "Wallet not found on HyperLiquid" });
    }

    const { startMs, endMs } = msRange(start, end);

    let fillsForPositions = [];
    let fundingRows = [];
    let accountValue = 0;

    try {
      [fillsForPositions, fundingRows] = await Promise.all([
        hl.fetchFillsForPositions(wallet, startMs, endMs),
        hl.fetchFunding(wallet, startMs, endMs),
      ]);

      const state = await hl.getClearinghouseState(wallet);
      accountValue = hl.getAccountValue(state);
    } catch (err) {
      return res.status(err?.status || 502).json({
        error: err?.message || "Failed to fetch HyperLiquid data",
      });
    }

    const { daily, summary } = await buildDailyPnl({
      start,
      end,
      startMs,
      endMs,
      fillsForPositions,
      fundingRows,
      getCandleClose: (coin, ms) => hl.getCandleClose(coin, ms),
      currentAccountValue: accountValue,
    });

    const notes = [
      "PnL calculated using daily close prices.",
      "UTC calendar days.",
      "Realized PnL from closed trades (closedPnl on fills).",
      "Unrealized PnL is day-over-day change in open position MTM.",
      "Net PnL = realized + unrealized - fees + funding.",
    ];

    if (fillsForPositions.length === 0 && fundingRows.length === 0) {
      notes.push("No fills or funding in range; daily rows are zeroed.");
    }

    res.json({
      wallet,
      start,
      end,
      daily,
      summary,
      diagnostics: {
        data_source: "hyperliquid_api",
        last_api_call: new Date().toISOString(),
        notes: notes.join(" "),
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || "Internal error" });
  }
});

module.exports = router;
