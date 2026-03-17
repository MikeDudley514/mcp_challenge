import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { z } from "zod";

const widgetHtml = readFileSync("public/widget.html", "utf8");

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
        },
      ],
    }),
  );

  server.registerTool(
    "get_crypto_data",
    {
      title: "Get Crypto Data",
      description:
        "Use this when the user wants to see live cryptocurrency market data, prices, or rankings.",
      inputSchema: { limit: z.number().default(10) },
      _meta: {
        "openai/outputTemplate": "ui://widget/crypto.html",
        "openai/toolInvocation/invoking": "Fetching crypto data…",
        "openai/toolInvocation/invoked": "Crypto data loaded",
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
          current_price: c.quotes.USD.price,
          market_cap: c.quotes.USD.market_cap,
          price_change_percentage_24h: c.quotes.USD.percent_change_24h,
        }));
        return {
          structuredContent: { cryptos },
          content: [{ type: "text", text: "Success." }],
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

  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (
    url.pathname === MCP_PATH &&
    ["GET", "POST", "DELETE"].includes(req.method)
  ) {
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
      console.error("MCP request error:", err);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () =>
  console.log(
    `🚀 crypto-monitor MCP server ready → http://localhost:${port}${MCP_PATH}`,
  ),
);
