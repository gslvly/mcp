import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import express from "express";
import cors from "cors";
import OpenAi from "openai";




const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:9040/mcp"),{
  
  }
);
const client = new Client({
  name: "example-client",
  version: "1.0.0",
});




await client.connect(transport);

const tools = await client.listTools();
console.log(tools);

const app = express();
app.use(express.text());
app.use(cors());
// console.log(str);

const openai = new OpenAi({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey:
    "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",
});

const render = async (
  str: string,
  usedTools: { name: string; description: string; ans: string }[]
) => {
  const res = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat-v3-0324:free",
    messages: [
      {
        role: "system",
        content: `
        你是一个总结器，将用户的提问与mcp-server工具输出结合起来，并且回答用户。使用的工具及结果如下：
        ${usedTools.map((it) => JSON.stringify(it))}。
        `,
      },
      {
        role: "user",
        content: str,
      },
    ],
  });
  return res.choices[0].message.content;
};

const getRouter = async (str: string) => {
  const res = await openai.chat.completions.create({
    model: "deepseek/deepseek-chat-v3-0324:free",
    messages: [
      {
        role: "system",
        content: `
        你是一个ai路由器，帮助识别用户意图,返回可调用的工具及其参数。找到后请返回name和arguments,因为可能有多个工具，请统一返回数组格式。禁止使用\`\`\`开头 我的工具mcp-server标准定义如下：
        ${tools.tools.map((tool) => JSON.stringify(tool)).join("\n")}。
        `,
      },
      {
        role: "user",
        content: str,
      },
    ],
  });
  console.log(res.choices[0].message.content)
  const json = JSON.parse(res.choices[0].message.content||"{}");
  console.log(json);
  return json;
};

const ask = async (v: string) => {
  const routes = await getRouter(v);
  if (!routes) return;

  const localRes = routes.map((it) => {
    console.log("calling tool", it);
    return client.callTool(it);
  });

  const data = await Promise.all(localRes);

  const input = data.map((it, i) => {
    return {
      ans: it,
      name: localRes[i].name,
      description: localRes[i].description,
    };
  });
  return render(v, input);
};

app.post("/mcp-chat", async (req, res) => {
  const ans = await ask(req.body);
  console.log(ans);
});

app.listen(9400);
const ans = await ask("今天天气怎么样？");
console.log(ans);
