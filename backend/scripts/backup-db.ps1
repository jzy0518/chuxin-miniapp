# 数据库一键备份脚本
# 功能：mysqldump 导出 chuxin 库到 E:\mysql\backup，文件名带日期时间，自动清理旧备份（保留最近 30 份）
# 用法：双击 E:\mysql\backup-db.bat，或执行: powershell -File backend/scripts/backup-db.ps1

$ErrorActionPreference = 'Stop'

$mysqlBin  = 'E:\mysql\server\mysql-8.4.4-winx64\bin'
$dbUser    = 'chuxin'
$dbPass    = 'chuxin123'
$backupDir = 'E:\mysql\backup'
$keepCount = 30   # 保留最近多少份

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$stamp   = Get-Date -Format 'yyyyMMdd_HHmmss'
$outFile = Join-Path $backupDir "chuxin_$stamp.sql"

# 通过环境变量传密码，避免出现在命令行/进程列表里
$env:MYSQL_PWD = $dbPass

# --no-tablespaces: 普通应用账号无 PROCESS 权限，跳过表空间导出
# --result-file: mysqldump 直接写文件（避免 PowerShell 管道转码问题）
& "$mysqlBin\mysqldump.exe" -u $dbUser --databases chuxin --routines --events --single-transaction --no-tablespaces --default-character-set=utf8mb4 --result-file="$outFile" 2>$null

if ($LASTEXITCODE -ne 0) {
  Remove-Item $outFile -ErrorAction SilentlyContinue
  Write-Host "[失败] 备份未成功，请确认 MySQL 服务(Mysql8.4)正在运行" -ForegroundColor Red
  exit 1
}

# 清理超过保留数量的旧备份
Get-ChildItem $backupDir -Filter 'chuxin_*.sql' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $keepCount |
  Remove-Item -Force

$sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "[成功] 备份完成: $outFile ($sizeKB KB)" -ForegroundColor Green