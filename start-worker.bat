@echo off
chcp 65001 >nul
title chuxin AI 分析 worker
cd /d "%~dp0backend\ai_worker"
echo ============================================
echo  启动 chuxin AI 分析 worker（轮询分析任务）
echo  关闭本窗口即停止
echo ============================================
if not exist "E:\python312\python.exe" (
  echo [错误] 未找到 Python，请先安装 Python 3.10+ 或修改本文件中的 python 路径
  pause
  exit /b 1
)
"E:\python312\python.exe" worker.py
pause