@echo off
chcp 65001 >nul
title chuxin 后端服务
cd /d "%~dp0backend"
echo ============================================
echo  启动 chuxin 后端 (http://127.0.0.1:3000)
echo  关闭本窗口即停止服务
echo ============================================
if not exist "C:\Program Files\nodejs\node.exe" (
  echo [错误] 未找到 Node.js，请先安装 Node 18+ 或修改本文件中的 node 路径
  pause
  exit /b 1
)
"C:\Program Files\nodejs\node.exe" src\app.js
pause