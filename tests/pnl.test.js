const { buildDailyPnl } = require("../src/lib/pnl");

describe("buildDailyPnl", () => {
  test("aggregates realized, fees, funding and net PnL by day", async () => {
    const start = "2025-08-01";
    const end = "2025-08-02";
    const startMs = Date.parse("2025-08-01T00:00:00Z");
    const endMs = Date.parse("2025-08-02T23:59:59.999Z");

    const fills = [
      {
        time: Date.parse("2025-08-01T12:00:00Z"),
        closedPnl: "100",
        fee: "2",
        coin: "ETH",
        px: "3000",
        sz: "1",
        side: "B",
      },
      {
        time: Date.parse("2025-08-02T12:00:00Z"),
        closedPnl: "20.5",
        fee: "1.1",
        coin: "ETH",
        px: "3100",
        sz: "0.5",
        side: "A",
      },
    ];

    const fundingRows = [
      {
        time: Date.parse("2025-08-01T18:00:00Z"),
        delta: { usdc: "-0.5" },
      },
    ];

    const { daily, summary } = await buildDailyPnl({
      start,
      end,
      startMs,
      endMs,
      fillsForPositions: fills,
      fundingRows,
      getCandleClose: async () => 3000,
      currentAccountValue: 10150,
    });

    expect(daily).toHaveLength(2);
    expect(daily[0].realized_pnl_usd).toBe(100);
    expect(daily[0].fees_usd).toBe(2);
    expect(daily[0].funding_usd).toBe(-0.5);
    expect(daily[0].net_pnl_usd).toBe(97.5);
    expect(summary.total_realized_usd).toBe(120.5);
    expect(summary.net_pnl_usd).toBe(daily[0].net_pnl_usd + daily[1].net_pnl_usd);
    expect(daily[1].equity_usd).toBeGreaterThan(daily[0].equity_usd);
  });
});
