import { ChatPromptTemplate } from "@langchain/core/prompts";

import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuid } from "uuid";
import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const llm = new ChatOpenAI({
  model: "deepseek-v3",
  configuration: {
    baseURL: "https://api.chatanywhere.tech",
    apiKey: "sk-BfHhY4kvNddaf0y00c6KF01mWC9G4hzksT0eCpGwNKkq61rj",
  },
});

const a = tool(
  (a, b) => {
    return a + b;
  },
  { name: "add", description: "加法" }
);


const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

const tools = client.listTools();

const toolNode = async (state: typeof MessagesAnnotation.State) => {
  // 模拟工具调用结果
  const toolResult = "42°C";
  // 添加工具结果消息
  const resultMessage = new AIMessage({
    content: toolResult,
    additional_kwargs: {
      tool_calls: undefined, // 清除工具调用标记
    },
  });

  return {
    messages: [],
  };
};

// Define the function that calls the model
const answer = async (state: typeof MessagesAnnotation.State) => {
  const response = await llm.stream(state.messages);

  return { messages: response };
};

// Define a new graph
const workflow = new StateGraph(MessagesAnnotation)
  // Define the node and edge
  .addNode("model", answer)
  .addEdge(START, "model")
  .addEdge("model", END);

const memory = new MemorySaver();
const app = workflow.compile({ checkpointer: memory });

const config = { configurable: { thread_id: uuid() } };
// const res1 = await app.invoke(
//   { messages: [{ role: "user", content: "我是 gs" }] },
//   config
// );
// console.log(res1);

const res2 = await app.invoke(
  { messages: [{ role: "user", content: "我名字叫gs" }] },
  config
);

const v = await app.stream(
  { messages: "你是谁？" },
  { ...config, streamMode: "values" }
);
