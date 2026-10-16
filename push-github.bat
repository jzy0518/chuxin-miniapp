@echo off
chcp 936 >nul
title chuxin 一键推送到 GitHub
cd /d "%~dp0"

rem 本机 Windows schannel 证书吊销检查会拦截 GitHub SSL（CRYPT_E_NO_REVOCATION_CHECK），
rem http.schannelCheckRevoke=false 在 git 2.55 上不生效，这里仅对本次会话关闭 SSL 校验。
set "GIT_SSL_NO_VERIFY=1"

echo ============================================
echo   chuxin 一键更新到 GitHub
echo   仓库: github.com/jzy0518/chuxin-miniapp
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 git，请先安装 Git for Windows
  goto :fail
)

rem ---- 当前分支 ----
for /f %%i in ('git branch --show-current') do set "BR=%%i"
if "%BR%"=="" set "BR=main"

rem ---- 提交说明：命令行参数 > 手动输入 > 默认时间戳 ----
rem 用法（在 cmd 中）: push-github.bat "我的提交说明"
rem 说明中避免使用 & ^| ^< ^> " 等特殊字符
set "MSG=%~1"
if "%MSG%"=="" set /p "MSG=请输入提交说明（直接回车 = 自动时间戳）: "
if "%MSG%"=="" (
  for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "MSG=update %%i"
)

rem ---- [1/3] 暂存并提交 ----
git add -A
git diff --cached --quiet
if errorlevel 1 (
  echo [1/3] 提交改动：%MSG%
  rem 消息经 GBK 转 UTF-8 后用文件提交，保证中文在 GitHub 上不乱码
  echo(%MSG%>"%TEMP%\chuxin_msg.txt"
  powershell -NoProfile -Command "$t=[IO.File]::ReadAllText($env:TEMP+'\chuxin_msg.txt',[Text.Encoding]::GetEncoding(936));[IO.File]::WriteAllText($env:TEMP+'\chuxin_msg_u8.txt',$t,(New-Object Text.UTF8Encoding($false)))"
  git commit -F "%TEMP%\chuxin_msg_u8.txt"
  if errorlevel 1 (
    del "%TEMP%\chuxin_msg.txt" "%TEMP%\chuxin_msg_u8.txt" >nul 2>nul
    echo [错误] 提交失败
    goto :fail
  )
  del "%TEMP%\chuxin_msg.txt" "%TEMP%\chuxin_msg_u8.txt" >nul 2>nul
) else (
  echo [1/3] 工作区无改动，跳过提交
)

rem ---- [2/3] 同步远程（其他设备有提交时自动 rebase）----
echo [2/3] 检查远程更新...
git fetch origin
if errorlevel 1 (
  echo [错误] 无法连接 GitHub，请检查网络/代理
  goto :fail
)
for /f %%i in ('git rev-list --count HEAD..origin/%BR%') do set "BEHIND=%%i"
if not "%BEHIND%"=="0" (
  echo       远程有 %BEHIND% 个新提交，正在 rebase...
  git pull --rebase origin %BR%
  if errorlevel 1 (
    echo [错误] rebase 发生冲突，请手动解决后重新运行本脚本
    goto :fail
  )
)

rem ---- [3/3] 推送 ----
for /f %%i in ('git rev-list --count origin/%BR%..HEAD') do set "AHEAD=%%i"
if "%AHEAD%"=="0" (
  echo [3/3] 没有待推送的提交，已是最新
  goto :ok
)
echo [3/3] 推送 %AHEAD% 个提交到 GitHub ^(%BR%^)...
git push origin %BR%
if errorlevel 1 (
  echo [错误] 推送失败，请查看上方错误信息
  goto :fail
)

:ok
echo.
echo ============================================
echo   完成！最新提交：
git log --oneline -1
echo ============================================
goto :end

:fail
echo.
echo ================ 执行失败，已中止 ================

:end
rem 仅双击运行时暂停看结果；从命令行调用时直接退出
echo %cmdcmdline% | %SystemRoot%\System32\find.exe /i "%~nx0" >nul && pause
