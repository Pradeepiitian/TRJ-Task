const express = require("express");
const config = require("./config");
const tokenRoutes = require("./routes/token");
const hyperliquidRoutes = require("./routes/hyperliquid");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/token", tokenRoutes);
app.use("/api/hyperliquid", hyperliquidRoutes);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

module.exports = app;
