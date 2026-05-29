const nock = require("nock");
const config = require("../src/config");
const { getCoin, normalizeToken } = require("../src/clients/coingecko");

describe("coingecko client", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test("normalizeToken maps market fields", () => {
    const token = normalizeToken(
      {
        id: "ethereum",
        symbol: "eth",
        name: "Ethereum",
        market_data: {
          current_price: { usd: 3000 },
          market_cap: { usd: 100 },
          total_volume: { usd: 50 },
          price_change_percentage_24h: -0.5,
        },
      },
      "usd"
    );

    expect(token.market_data.current_price_usd).toBe(3000);
  });

  test("getCoin throws 404 when token missing", async () => {
    nock(config.coingeckoBaseUrl).get("/coins/missing-coin").query(true).reply(404);

    await expect(getCoin("missing-coin")).rejects.toMatchObject({ status: 404 });
  });
});
