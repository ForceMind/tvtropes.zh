$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

docker compose down
if ($LASTEXITCODE -ne 0) {
    Write-Host "停止服务失败，请检查 docker compose 状态。" -ForegroundColor Red
    exit 1
}

Write-Host "服务已停止。" -ForegroundColor Green
