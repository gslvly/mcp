import asyncio
import concurrent.futures
import os
from unittest import result
import concurrent
from fastapi import Body, FastAPI, Request, Response, HTTPException
from fastapi.concurrency import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有域名
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法 GET/POST/OPTIONS...
    allow_headers=["*"],  # 允许所有 headers)
)


@app.get("/aa")
async def get_aa():
    async def write():
        for i in range(10):
            yield f"哈哈{i}\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        write(), media_type="text/plain", headers={"Cache-Control": "no-cache"}
    )


def task(n):
    """CPU密集型任务"""
    res = 0
    for i in range(n):
        res += i
    return res


def batch_task(tasks):
    """批量处理任务"""
    return [task(n) for n in tasks]


# 全局executor变量
cpuExec: concurrent.futures.ProcessPoolExecutor = None


@asynccontextmanager
async def my_app_lifespan(app: FastAPI):
    global cpuExec
    print("\n--- MyAppLifespan: 应用启动中 ---")
    
    # 使用CPU核心数-1作为工作进程数，为系统保留1个核心
    max_workers = max(1, os.cpu_count() - 1)
    print(f"MyAppLifespan: 使用 {max_workers} 个工作进程")
    
    # 创建ProcessPoolExecutor但不使用with语句
    cpuExec = concurrent.futures.ProcessPoolExecutor(max_workers=max_workers)
    print("MyAppLifespan: ProcessPoolExecutor已初始化")
    
    try:
        yield  # 应用在这里运行
    finally:
        print("\n--- MyAppLifespan: 应用关闭中 ---")
        # 手动关闭executor
        if cpuExec:
            cpuExec.shutdown(wait=True)
            print("MyAppLifespan: ProcessPoolExecutor已关闭")
        print("MyAppLifespan: 资源已清理。")


# 应用lifespan
app.router.lifespan_context = my_app_lifespan


@app.get("/add/{bb}")
async def debug_query(request: Request, res: Response, bb: int):
    """单个计算任务"""
    if bb < 0:
        raise HTTPException(status_code=400, detail="参数bb必须为非负数")
    
    res.headers["bbbb"] = "eeee"
    loop = asyncio.get_running_loop()
    
    try:
        # 使用全局executor执行任务
        result = await loop.run_in_executor(cpuExec, task, bb)
        return {"result": result, "input": bb}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"计算错误: {str(e)}")


@app.post("/add/batch")
async def batch_compute(data: dict = Body(...)):
    """批量计算任务 - 充分利用多核CPU"""
    if "tasks" not in data:
        raise HTTPException(status_code=400, detail="请提供tasks数组")
    
    tasks = data["tasks"]
    if not isinstance(tasks, list):
        raise HTTPException(status_code=400, detail="tasks必须是数组")
    
    if any(not isinstance(t, int) or t < 0 for t in tasks):
        raise HTTPException(status_code=400, detail="所有任务参数必须为非负整数")
    
    if len(tasks) > 100:  # 限制批量大小
        raise HTTPException(status_code=400, detail="批量任务数量不能超过100")
    
    loop = asyncio.get_running_loop()
    
    try:
        # 方法1: 并行提交多个任务
        futures = []
        for task_param in tasks:
            future = loop.run_in_executor(cpuExec, task, task_param)
            futures.append(future)
        
        # 等待所有任务完成
        results = await asyncio.gather(*futures)
        
        return {
            "results": results,
            "count": len(results),
            "inputs": tasks
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量计算错误: {str(e)}")


@app.post("/add/batch_optimized")
async def batch_compute_optimized(data: dict = Body(...)):
    """优化的批量计算 - 减少进程间通信开销"""
    if "tasks" not in data:
        raise HTTPException(status_code=400, detail="请提供tasks数组")
    
    tasks = data["tasks"]
    if not isinstance(tasks, list):
        raise HTTPException(status_code=400, detail="tasks必须是数组")
    
    if any(not isinstance(t, int) or t < 0 for t in tasks):
        raise HTTPException(status_code=400, detail="所有任务参数必须为非负整数")
    
    if len(tasks) > 1000:  # 更大的批量限制
        raise HTTPException(status_code=400, detail="批量任务数量不能超过1000")
    
    loop = asyncio.get_running_loop()
    
    try:
        # 方法2: 将任务分批，减少进程间通信
        batch_size = max(1, len(tasks) // (os.cpu_count() - 1))
        batches = [tasks[i:i + batch_size] for i in range(0, len(tasks), batch_size)]
        
        # 并行处理每个批次
        futures = []
        for batch in batches:
            future = loop.run_in_executor(cpuExec, batch_task, batch)
            futures.append(future)
        
        # 等待所有批次完成
        batch_results = await asyncio.gather(*futures)
        
        # 合并结果
        results = []
        for batch_result in batch_results:
            results.extend(batch_result)
        
        return {
            "results": results,
            "count": len(results),
            "inputs": tasks,
            "batches_used": len(batches)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"优化批量计算错误: {str(e)}")


@app.post("/post")
async def pp(req: Request):
    raw = req.headers.items()
    print(raw)
    return "req"


if __name__ == "__main__":
    print("启动FastAPI服务器...")
    uvicorn.run(app, host="0.0.0.0", port=8000)