const request = require("supertest");
const nock = require("nock");
const config = require("../src/config");

jest.mock("../src/clients/ai", () => ({
  getInsight: jest.fn().mockResolvedValue({
    insight: { reasoning: "Price is stable.", sentiment: "Neutral" },
    model: { provider: "openai", model: "gpt-4o-mini" },
  }),
}));

const app = require("../src/index");

describe("API routes", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("GET /api/hyperliquid invalid wallet returns 400", async () => {
    const res = await request(app).get(
      "/api/hyperliquid/not-a-wallet/pnl?start=2025-08-01&end=2025-08-02"
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/hyperliquid bad dates returns 400", async () => {
    const wallet = "0x0000000000000000000000000000000000000001";
    const res = await request(app).get(
      `/api/hyperliquid/${wallet}/pnl?start=bad&end=2025-08-02`
    );
    expect(res.status).toBe(400);
  });

  test("POST /api/token/:id/insight returns combined payload", async () => {
    const coinBody = {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      market_data: {
        current_price: { usd: 50000 },
        market_cap: { usd: 1000000000 },
        total_volume: { usd: 50000000 },
        price_change_percentage_24h: 1.5,
      },
    };

    nock(config.coingeckoBaseUrl)
      .get("/coins/bitcoin")
      .query(true)
      .reply(200, coinBody);

    nock(config.coingeckoBaseUrl)
      .get("/coins/bitcoin/market_chart")
      .query(true)
      .reply(200, { prices: [[1, 49000], [2, 50000]] });

    const res = await request(app)
      .post("/api/token/bitcoin/insight")
      .send({ vs_currency: "usd", history_days: 7 });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("coingecko");
    expect(res.body.token.id).toBe("bitcoin");
    expect(res.body.insight.sentiment).toBe("Neutral");
    expect(res.body.model.provider).toBe("openai");
  });
});
