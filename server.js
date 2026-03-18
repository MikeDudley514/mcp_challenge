import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { z } from "zod";

const widgetHtml = readFileSync("public/widget.html", "utf8");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:8787";

function createCryptoServer() {
  const server = new McpServer({ name: "crypto-monitor", version: "1.0.0" });

  server.registerResource(
    "crypto-widget",
    "ui://widget/crypto.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/crypto.html",
          mimeType: "text/html+skybridge",
          text: widgetHtml,
          _meta: {
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": "https://athenachat.bot",
            "openai/widgetUrl": `${BASE_URL}/widget.html`,
          },
        },
      ],
    }),
  );

  server.registerTool(
    "get_crypto_data",
    {
      title: "Get Crypto Data",
      description:
        "Use this when the user wants to see live cryptocurrency prices, market caps, rankings, or market data. Returns an interactive widget with sorting and drill-down.",
      inputSchema: { limit: z.number().default(10) },
      _meta: {
        "openai/outputTemplate": "ui://widget/crypto.html",
        "openai/toolInvocation/invoking": "Fetching live crypto data…",
        "openai/toolInvocation/invoked": "Crypto market data loaded",
        "openai/widgetAccessible": true,
        "openai/widgetDomain": "https://athenachat.bot",
      },
    },
    async ({ limit }) => {
      try {
        const resp = await fetch(
          `https://api.coinpaprika.com/v1/tickers?limit=${limit}`,
        );
        const json = await resp.json();
        const cryptos = json.map((c) => ({
          id: c.id,
          symbol: c.symbol,
          name: c.name,
          rank: c.rank,
          current_price: c.quotes.USD.price,
          market_cap: c.quotes.USD.market_cap,
          volume_24h: c.quotes.USD.volume_24h,
          price_change_percentage_24h: c.quotes.USD.percent_change_24h,
          change_7d: c.quotes.USD.percent_change_7d,
          change_30d: c.quotes.USD.percent_change_30d,
          ath: c.quotes.USD.ath_price,
          circulating: c.circulating_supply,
        }));
        return {
          structuredContent: { cryptos },
          content: [{ type: "text", text: "Success." }],
          _meta: {
            "openai/outputTemplate": "ui://widget/crypto.html",
            "openai/widgetDomain": "https://athenachat.bot",
            "openai/widgetUrl": `${BASE_URL}/widget.html`,
            "openai/widgetHtml": widgetHtml,
          },
        };
      } catch (e) {
        return {
          structuredContent: { cryptos: [] },
          content: [{ type: "text", text: "API Error." }],
        };
      }
    },
  );

  return server;
}

const MCP_PATH = "/mcp";
const port = Number(process.env.PORT ?? 8787);

const httpServer = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res
      .writeHead(200, { "content-type": "text/plain" })
      .end("crypto-monitor MCP server");
    return;
  }

  if (req.method === "GET" && req.url === "/widget.html") {
    console.log("✅ Widget HTML requested from:", req.headers["user-agent"]);
    res
      .writeHead(200, {
        "content-type": "text/html",
        "Access-Control-Allow-Origin": "*",
      })
      .end(widgetHtml);
    return;
  }

  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (
    url.pathname === MCP_PATH &&
    ["GET", "POST", "DELETE"].includes(req.method)
  ) {
    req.headers["accept"] = "application/json, text/event-stream";
    const server = createCryptoServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("MCP error:", err);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () =>
  console.log(
    `🚀 crypto-monitor ready → http://localhost:${port}${MCP_PATH}\n   Widget: ${BASE_URL}/widget.html`,
  ),
);
