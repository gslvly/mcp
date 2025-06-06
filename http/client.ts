import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import express from "express";
import axios from "axios";
import cors from "cors";
import OpenAi from "openai";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:9040/mcp")
);

const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

await client.connect(transport);


const tools = await client.listTools();
console.log(tools)

const app = express();
app.use(express.text());
app.use(cors());
// console.log(str);

const openai = new OpenAi({
  baseURL: "https://api.chatanywhere.tech",
  apiKey: "sk-BfHhY4kvNddaf0y00c6KF01mWC9G4hzksT0eCpGwNKkq61rj",
});

const render = async (
  str: string,
  usedTools: { name: string; description: string; ans: string }[]
) => {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
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
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
        你是一个ai路由器，帮助识别用户意图,返回可调用的工具及其参数。找到后请返回name和arguments,因为可能有多个工具，请统一返回数组格式, 我的工具mcp-server标准定义如下：
        ${tools.tools.map((tool) => JSON.stringify(tool)).join("\n")}。
        `,
      },
      {
        role: "user",
        content: str,
      },
    ],
  });

  const json = JSON.parse(res.choices[0].message.content);
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
const ans = await ask("你好，我想知道2+2等于多少？");
console.log(ans);
