import asyncio
import json
import httpx
import aiohttp
from bs4 import BeautifulSoup
import openai
import time

# 配置项
NEWS_URL = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
PUSH_API = "https://your-api.com/push"
OPENAI_API_KEY = "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"
openai.api_base = "https://openrouter.ai/api/v1"
openai.api_key = OPENAI_API_KEY

# 异步爬取详情页
async def fetch_article(session, href):
    try:
        async with session.get(href, timeout=5) as detail:
            detail.raise_for_status()
            text = await detail.text()
            detail_soup = BeautifulSoup(text, "html.parser")
            title = detail_soup.select_one("h1").text.strip()
            paragraphs = detail_soup.select(".article p")
            content = "\n".join(p.text.strip() for p in paragraphs if p.text.strip())
            if len(content) > 200:
                return {"title": title, "url": href, "content": content}
    except Exception as e:
        print("跳过错误链接：", href, str(e))
    return None

# 异步爬取首页新闻链接并并发获取详情

async def crawl_news():
    
    try:
        async with httpx.AsyncClient() as client:
            print('aaa')
            res = await client.get(url=NEWS_URL)
            text =  res.text
            obj = json.loads(text)
            print(obj)

    except Exception:
        return []

# 使用 AI 改写（同步）
def rewrite_with_ai(content):
    prompt = f"请将以下新闻内容进行原创改写，风格保持正式：\n{content}"
    try:
        response = openai.ChatCompletion.create(
            model="deepseek/deepseek-chat-v3-0324:free",
            messages=[
                {"role": "system", "content": "你是一个资深新闻编辑，擅长将新闻改写为原创文章。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print("重写失败：", e)
        return None

# 包装为异步改写接口
async def rewrite_with_ai_async(content):
    return await asyncio.to_thread(rewrite_with_ai, content)

# 推送内容（异步）
async def push_article(session, title, content):
    payload = {
        "title": title,
        "content": content
    }
    try:
        async with session.post(PUSH_API, json=payload, timeout=10) as r:
            print(f"推送结果: {r.status}", await r.text())
    except Exception as e:
        print("推送失败：", e)

# 每篇文章完整流程：获取 -> 改写 -> 推送
async def process_article(session, href):
    article = await fetch_article(session, href)
    if article:
        rewritten = await rewrite_with_ai_async(article["content"])
        if rewritten:
            await push_article(session, article["title"], rewritten)

# 主流程（异步）
async def run():
    print("开始运行任务：", time.strftime("%Y-%m-%d %H:%M:%S"))
    hrefs = await crawl_news()
    if not hrefs:
        print("没有抓到任何链接，任务跳过。")
        return

    async with httpx.AsyncClient() as session:
        tasks = [process_article(session, href) for href in hrefs]
        await asyncio.gather(*tasks)

# 启动入口
if __name__ == "__main__":
    print("新闻机器人启动...")
    asyncio.run(run())
