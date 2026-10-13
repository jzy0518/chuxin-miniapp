# -*- coding: utf-8 -*-
"""
AI 视频分析 worker —— 接入你自己训练的模型的骨架

说明：
  - 本脚本轮询数据库里 status=0（排队中）的分析任务，
    找到后读取视频文件 -> 调用 analyze_video() 推理 -> 把结果回调给 Node 后端落库。
  - 顶部「配置区」按你的环境修改；核心是 analyze_video() 函数，
    把你的模型加载和推理代码放进去即可，其余不用动。

运行（需要 Python 3.10+）：
  1. pip install -r requirements.txt
  2. python worker.py

接入你的模型只需要改一处：
  analyze_video(video_path, task) 函数 —— 用你的权重做推理，
  返回 {score, corrects, model, raw}，见函数内注释。

当前默认返回假数据（与 JS 模拟器行为一致），用于先跑通链路。
"""
import json
import os
import time

import pymysql
import requests

# ==================== 配置区：按你的环境修改 ====================
DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
DB_USER = os.environ.get("DB_USER", "chuxin")
DB_PASS = os.environ.get("DB_PASS", "chuxin123")
DB_NAME = os.environ.get("DB_NAME", "chuxin")

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:3000")
WORKER_KEY = os.environ.get("WORKER_KEY", "chuxin-worker-dev-key")  # 与后端 .env 的 ANALYSIS_WORKER_KEY 一致

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", r"e:\chuxin-Frontend\backend\uploads")  # 视频存放目录（与后端一致）
POLL_INTERVAL = 3  # 轮询间隔（秒）
# ==================================================================

def get_connection():
    return pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER,
        password=DB_PASS, database=DB_NAME, charset="utf8mb4",
    )


def analyze_video(video_path: str, task: dict) -> dict:
    """你的模型推理入口 —— 唯一需要改的地方。

    参数：
      video_path: 本地视频文件完整路径（已为你定位好）
      task:       video_analysis 行（含 id / video_id / action_type_id）

    返回（建议结构）：
      {
        "score": 0-100 的动作得分,
        "corrects": [
          {"pointName": "纠正点名称", "correct": False, "confidence": 0.92, "frameTime": 5.2},
          ...
        ],
        "model": "你的模型名",
        "raw": {}   # 想额外存储的任何原始数据
      }
    """
    # TODO: 在这里加载你的训练权重并推理，例如：
    #   model = load_your_model("weight.pth")
    #   result = model.detect(video_path)
    # 然后把结果转成上面的结构返回。
    #
    # 下面是占位假数据，先打通链路用，接入真实模型后删除。
    print(f"  -> [worker] 分析任务 #{task['id']}（视频 {os.path.basename(video_path)}）")
    time.sleep(2)  # 模拟推理耗时，真实模型时删除
    return {
        "score": 60 + int((hash(video_path) % 30)),  # 假得分 60-89
        "corrects": [
            {"pointName": "持拍手肘抬太低", "correct": False, "confidence": 0.82, "frameTime": 2.1},
            {"pointName": "击球点偏后", "correct": False, "confidence": 0.75, "frameTime": 4.6},
        ],
        "model": "your-model-v0",
        "raw": {},
    }


def report_result(task_id: int, status: int, score=None, result_json=None, error_msg=None):
    """把结果回调给 Node 后端（POST /api/analysis/:id/result）"""
    payload = {"status": status}
    if status == 1:
        payload["score"] = score
        payload["resultJson"] = result_json
    else:
        payload["errorMsg"] = error_msg or "分析失败"
    resp = requests.post(
        f"{API_BASE}/api/analysis/{task_id}/result",
        headers={"x-worker-key": WORKER_KEY, "Content-Type": "application/json"},
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  -> [worker] 回调失败 HTTP {resp.status_code}: {resp.text[:200]}")


def main():
    print("[worker] 已就绪，开始轮询待分析任务...")
    while True:
        conn = None
        try:
            conn = get_connection()
            with conn.cursor(pymysql.cursors.DictCursor) as cur:
                cur.execute(
                    """
                    SELECT a.id, a.video_id, a.action_type_id, v.file_key
                    FROM video_analysis a
                    JOIN video v ON v.id = a.video_id
                    WHERE a.status = 0
                    ORDER BY a.id ASC
                    LIMIT 1
                    """
                )
                task = cur.fetchone()
            if not task:
                time.sleep(POLL_INTERVAL)
                continue

            video_path = os.path.join(UPLOAD_DIR, task["file_key"])
            if not os.path.exists(video_path):
                print(f"  -> [worker] 任务 #{task['id']} 的视频文件不存在: {video_path}")
                report_result(task["id"], 2, error_msg="视频文件不存在")
                continue

            try:
                result = analyze_video(video_path, task)
                report_result(task["id"], 1, score=result.get("score"), result_json=result)
                print(f"  -> [worker] 任务 #{task['id']} 完成，得分 {result.get('score')}")
            except Exception as e:  # 推理异常 -> 标记失败
                print(f"  -> [worker] 任务 #{task['id']} 推理异常: {e}")
                report_result(task["id"], 2, error_msg=str(e)[:200])
        except Exception as e:
            print(f"[worker] 轮询异常: {e}，5 秒后重试")
            time.sleep(5)
        finally:
            if conn:
                conn.close()


if __name__ == "__main__":
    main()