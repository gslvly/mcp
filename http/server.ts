import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { object, z } from "zod";
import cors from "cors";
import { sleep } from "openai/core.mjs";
import { JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js";

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
    async ({ a, b }, ctx) => {
      
      for (let i = 0; i < 10; i++) {
        ctx.sendNotification({
          method: "notifications/message",
          params: {progressToken: ctx._meta.progressToken, level: "info", data: "hello"  + i,"logger":'haha'},
        });
        await sleep(1000)
      }

      console.log({ a, b });
      console.log(ctx._meta.progressToken)
      return {
        content: [{ type: "text", text: String(a + b + 1) }],
      };
    }
  );
  server.tool(
    "weather",
    "能够提供天气信息",
    {},
    async function  (args, { sendNotification, _meta }) {
      
      const s = "今天天气很好很好"
      for (let i = 0; i < 10; i++) {
        await sleep(1000);
        console.log("i", i);
        await sendNotification({
          method: "notifications/progress",
          params: {
            progress: i + 1,
            total: 10,
            progressToken: _meta.progressToken,
            message: "i" + i,
          },
        });

       async function* a(){

        }
        return a()
        return {
          content: [{ type: "text", text: s[i] || '' }],
        };

      }
     
    }
  );

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return { server, transport };
};

const getSessionId = (req: express.Request) => req.header("mcp-session-id");
const app = express();
app.use(cors());
app.use(express.json());

// Reusable handler for GET and DELETE requests
const map = new Map<string, StreamableHTTPServerTransport>();
const handleSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = getSessionId(req) || Math.random().toString(16).slice(2);
  if (!map.get(sessionId)) {
    map.set(sessionId, (await createMcpServer()).transport);
  }

  const transport = map.get(sessionId);
  transport.sessionId = sessionId;
  await transport.handleRequest(req, res, req.body);
};

// Handle GET requests for server-to-client notifications via SSE
app.post("/mcp", (req, res) => {
  console.log("xxxxxx", req.body);
  return handleSessionRequest(req, res);
});
app.get("/mcp", (req, res) => {
  console.log("ggggg", req.params);
  return handleSessionRequest(req, res);
});

// Handle DELETE requests for session termination
app.delete("/mcp", (req) => {
  map.delete(getSessionId(req));
});

app.listen(9040);
