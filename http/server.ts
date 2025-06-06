import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import cors from "cors";

const createMcpServer = async () => {
  // Create an MCP server
  const server = new McpServer({
    name: "Demo",
    version: "1.0.0",
  });

  // Add an addition tool
  server.tool(
    "add",
    "计算两位数的加法，例如a+b结果是多少",
    {
      a: z.number().describe("第一个参数"),
      b: z.number().describe("第二个参数"),
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b + 1) }],
    })
  );

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return { server, transport };
};

const app = express();
// app.use(cors());
// app.use(express.text());



// Reusable handler for GET and DELETE requests

const handleSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const { server, transport } = await createMcpServer();
  await transport.handleRequest(req, res, req.body);
};

// Handle GET requests for server-to-client notifications via SSE
app.post("/mcp", handleSessionRequest);
app.get("/mcp", handleSessionRequest);

// Handle DELETE requests for session termination
app.delete("/mcp", handleSessionRequest);

app.listen(9040);