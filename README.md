# 🪙 Crypto Monitor — Athena AI Agent

An MCP server that brings live cryptocurrency market data into [Athena AI](https://athenachat.bot) as an interactive, sortable widget. Built on the [Model Context Protocol](https://modelcontextprotocol.io/) with a vanilla HTML/JS frontend served inline.

---

## ✨ Features

- **Live market data** — fetches top N coins from the [CoinPaprika API](https://api.coinpaprika.com/) (no API key required)
- **Interactive widget** — sortable table with price, 24h/7d change, market cap, and volume
- **Drill-down detail panel** — click any row to expand ATH, 30d change, circulating supply, and more
- **Athena-native** — renders inline in the chat via `text/html+skybridge`, populated from `window.openai.toolOutput`
- **Zero dependencies on the frontend** — single self-contained HTML file

---

## 🗂 Project Structure

```
.
├── server.js          # MCP server (Node.js, ESM)
├── public/
│   └── widget.html    # Frontend widget (served inline and at /widget.html)
├── package.json
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm start
# or
node server.js
```

The server starts on `http://localhost:8787`.

| Endpoint           | Description                     |
| ------------------ | ------------------------------- |
| `GET /`            | Health check                    |
| `GET /widget.html` | Serves the widget HTML directly |
| `POST /mcp`        | MCP endpoint for Athena         |

---

## 🔧 Configuration

| Environment Variable | Default                 | Description                               |
| -------------------- | ----------------------- | ----------------------------------------- |
| `PORT`               | `8787`                  | HTTP port the server listens on           |
| `BASE_URL`           | `http://localhost:8787` | Public base URL (used in widget metadata) |

For production or ngrok tunnels, set `BASE_URL` to your public URL:

```bash
BASE_URL=https://your-subdomain.ngrok.app node server.js
```

---

## 🧩 How It Works

### Architecture

```
User prompt → Athena model → calls get_crypto_data tool
                                      ↓
                            server fetches CoinPaprika API
                                      ↓
                     returns structuredContent: { cryptos }
                       + _meta pointing to widget HTML
                                      ↓
                  Athena injects data via window.openai.toolOutput
                                      ↓
                         widget renders the market table
```

### Tool: `get_crypto_data`

Triggered when the user asks about live crypto prices, rankings, or market data.

**Input:**

| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| `limit`   | number | `10`    | Number of coins to fetch |

**Output (`structuredContent`):**

```json
{
  "cryptos": [
    {
      "id": "btc-bitcoin",
      "symbol": "BTC",
      "name": "Bitcoin",
      "rank": 1,
      "current_price": 67000,
      "market_cap": 1300000000000,
      "volume_24h": 28000000000,
      "price_change_percentage_24h": 1.23,
      "change_7d": -2.1,
      "change_30d": 14.5,
      "ath": 73750,
      "circulating": 19700000
    }
  ]
}
```

### Widget data flow

The widget reads from `window.openai.toolOutput` on load (injected by Athena) and also listens for `openai:set_globals` events for subsequent re-renders:

```js
// Initial load
if (window.openai?.toolOutput) {
  ingest(window.openai.toolOutput);
}

// Subsequent updates
window.addEventListener("openai:set_globals", (event) => {
  const globals = event.detail?.globals;
  if (globals?.toolOutput) ingest(globals.toolOutput);
});
```

---

## 🌐 Deploying to Athena

### 1. Expose your server

During development, use [ngrok](https://ngrok.com/) to tunnel your local server:

```bash
ngrok http 8787
```

Set the public URL as `BASE_URL`:

```bash
BASE_URL=https://abc123.ngrok.app node server.js
```

### 2. Add the connector in Athena

1. Go to [athenachat.bot/chatbot/mybots/create](https://athenachat.bot/chatbot/mybots/create)
2. Fill in name, description, and system prompt
3. In the MCP section, enter your public MCP URL: `https://your-url.ngrok.app/mcp`
4. Save and click **Go to Agent** to test

### 3. Refresh after changes

After updating tools or metadata, click **Refresh** in **Settings → Connectors**.

---

## 🐛 Troubleshooting

**Widget shows "Loading market data…" but never populates**
→ Make sure `window.openai.toolOutput` is being injected by Athena. Confirm the tool response returns `structuredContent: { cryptos }` and that `_meta["openai/outputTemplate"]` points to `"ui://widget/crypto.html"`.

**`window.openai` is undefined**
→ The runtime is only injected for resources with `mimeType: "text/html+skybridge"`. Double-check the MIME type on your registered resource.

**MCP tool never triggers**
→ The tool description starts with `"Use this when…"` — ensure you're prompting Athena with relevant keywords like "crypto prices", "top coins", or "market cap".

**API Error in tool response**
→ CoinPaprika's free API has rate limits. Wait a moment and try again, or reduce the `limit` parameter.

---

## 📦 Dependencies

| Package                     | Version   | Purpose                 |
| --------------------------- | --------- | ----------------------- |
| `@modelcontextprotocol/sdk` | `^1.27.1` | MCP server primitives   |
| `zod`                       | `^4.3.6`  | Input schema validation |

---

## 📄 License

ISC
