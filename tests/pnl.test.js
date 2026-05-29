const { buildDailyPnl } = require("../src/lib/pnl");

describe("buildDailyPnl", () => {
  test("aggregates realized, fees, and funding by day", async () => {
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
      start: "2025-08-01",
      end: "2025-08-02",
      fills,
      fundingRows,
      getCandleClose: async () => 3000,
      initialEquity: 10000,
    });

    expect(daily).toHaveLength(2);
    expect(daily[0].realized_pnl_usd).toBe(100);
    expect(daily[0].fees_usd).toBe(2);
    expect(daily[0].funding_usd).toBe(-0.5);
    expect(summary.total_realized_usd).toBe(120.5);
    expect(summary.total_fees_usd).toBe(3.1);
    expect(summary.total_funding_usd).toBe(-0.5);
  });
});
