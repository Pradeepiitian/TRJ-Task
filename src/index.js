const express = require("express");
const config = require("./config");
const tokenRoutes = require("./routes/token");
const hyperliquidRoutes = require("./routes/hyperliquid");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.json({
    name: "Token Analytics API",
    endpoints: {
      health: "GET /health",
      tokenInsight: "POST /api/token/:id/insight",
      hyperliquidPnl: "GET /api/hyperliquid/:wallet/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD",
    },
  });
});

app.use("/api/token", tokenRoutes);
app.use("/api/hyperliquid", hyperliquidRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err?.message || "Server error" });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

module.exports = app;
