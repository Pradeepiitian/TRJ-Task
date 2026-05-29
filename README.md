# Token Insight & Analytics API

Backend assignment implementation: **Node.js + Express**, **CoinGecko**, **HyperLiquid**, and **AI** (OpenAI / Hugging Face / Ollama).

## Deliverables checklist

| Requirement | Status |
|-------------|--------|
| GitHub repo with source | Yes |
| README + Docker setup | Yes |
| `POST /api/token/:id/insight` | Yes |
| `GET /api/hyperliquid/:wallet/pnl` | Yes |
| CoinGecko (no key) | Yes |
| AI via `.env` (keys not committed) | Yes |
| Postman collection | `postman/token-analytics.postman_collection.json` |
| Unit tests | `npm test` |

---

## Quick start (Docker — preferred)

```bash
cp .env.example .env
# Edit .env — set OPENAI_API_KEY (or another AI provider)

docker compose up --build
```

API: http://localhost:3000

---

## Quick start (local)

**Prerequisites:** Node.js 20+

```bash
npm install
cp .env.example .env
```

Edit `.env`, then:

```bash
npm run dev
```

---

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

| Variable | Description | Key required? |
|----------|-------------|---------------|
| `PORT` | Server port (default `3000`) | No |
| `COINGECKO_BASE_URL` | `https://api.coingecko.com/api/v3` | **No** (free public API) |
| `HYPERLIQUID_INFO_URL` | `https://api.hyperliquid.xyz/info` | **No** (public info endpoint) |
| `AI_PROVIDER` | `openai`, `huggingface`, or `ollama` | — |
| `OPENAI_API_KEY` | OpenAI key | **Yes** (if using OpenAI) |
| `OPENAI_MODEL` | e.g. `gpt-4o-mini` | No |
| `HF_API_KEY` / `HF_MODEL` | Hugging Face | **Yes** (if using HF) |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Local Ollama | No key (local) |

**Only AI keys go in `.env`.** CoinGecko and HyperLiquid do not use API keys in this project.

### AI setup

**OpenAI (default)** — uses official `openai` npm package and `responses.create`

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
```

Key and model go in `.env` only (never in source code).

**Hugging Face**

```env
AI_PROVIDER=huggingface
HF_API_KEY=hf_your_token
HF_MODEL=google/flan-t5-large
```

**Ollama (local)**

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

Docker + Ollama on host: use `http://host.docker.internal:11434`.

---

## API 1 — Token Insight

**`POST /api/token/:id/insight`**

### Flow

1. Fetch token from CoinGecko `GET /coins/{id}`
2. Optional chart: `GET /coins/{id}/market_chart`
3. Build prompt → call AI → parse JSON
4. Validate `insight.reasoning` (string) and `insight.sentiment` (`Bullish` | `Bearish` | `Neutral`)
5. Return combined JSON

### Request body (optional)

```json
{
  "vs_currency": "usd",
  "history_days": 30
}
```

### Example

```bash
curl -X POST http://localhost:3000/api/token/chainlink/insight \
  -H "Content-Type: application/json" \
  -d "{\"vs_currency\":\"usd\",\"history_days\":30}"
```

### Example response

```json
{
  "source": "coingecko",
  "token": {
    "id": "chainlink",
    "symbol": "link",
    "name": "Chainlink",
    "market_data": {
      "current_price_usd": 7.23,
      "market_cap_usd": 3500000000,
      "total_volume_usd": 120000000,
      "price_change_percentage_24h": -1.2
    }
  },
  "insight": {
    "reasoning": "...",
    "sentiment": "Neutral"
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

### Errors

| Status | Cause |
|--------|--------|
| 404 | Unknown token id on CoinGecko |
| 502 | CoinGecko / AI failure or invalid AI JSON |
| 503 | AI provider not configured |

---

## API 2 — HyperLiquid daily PnL

**`GET /api/hyperliquid/:wallet/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD`**

### Data sources (HyperLiquid `POST /info`)

| Data | API type |
|------|----------|
| Trades / realized PnL / fees | `userFillsByTime` |
| Funding | `userFunding` |
| Daily close (unrealized MTM) | `candleSnapshot` (1d) |
| Account value (equity baseline) | `clearinghouseState` |

### Daily calculations (UTC)

- **Realized PnL** — sum of `closedPnl` on fills that day  
- **Fees** — sum of `fee` on fills that day  
- **Funding** — sum of `delta.usdc` on funding events that day  
- **Unrealized PnL** — day-over-day change in open-position mark-to-market (1d candle close)  
- **Net PnL** = realized + unrealized − fees + funding  
- **Equity** — rolls forward from `(current account value − period net PnL)`

Fills up to **90 days before** `start` are loaded to reconstruct open positions.

### Example

```bash
curl "http://localhost:3000/api/hyperliquid/0xYOUR_WALLET/pnl?start=2025-08-01&end=2025-08-07"
```

### Errors

| Status | Cause |
|--------|--------|
| 400 | Invalid wallet or dates, or range > 90 days |
| 404 | Wallet not on HyperLiquid |
| 502 | HyperLiquid API error |

---

## Postman

1. Import `postman/token-analytics.postman_collection.json`
2. Set `baseUrl` = `http://localhost:3000`
3. Run **Health** → **Token Insight** → **HyperLiquid Daily PnL**

---

## Tests

```bash
npm test
```

---

## Project structure

```
src/
  index.js              Express app
  config.js             Environment
  clients/
    coingecko.js        CoinGecko API
    hyperliquid.js      HyperLiquid info API
    ai.js               OpenAI / HF / Ollama
  lib/
    dates.js            Date parsing (UTC)
    pnl.js              Daily PnL aggregation
    format.js           Response rounding
    validate.js         Wallet validation
  routes/
    token.js            POST /api/token/:id/insight
    hyperliquid.js      GET /api/hyperliquid/:wallet/pnl
tests/
postman/
Dockerfile
docker-compose.yml
```

---

## Health

```bash
curl http://localhost:3000/health
# {"ok":true}
```
