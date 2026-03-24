param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
# PowerShell 7 may convert native stderr output into errors when this is true.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot
$script:LastComposeOutput = ""

function Fail {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Test-DockerReady {
    cmd /c "docker info >nul 2>nul" | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Get-DockerDesktopPath {
    $candidates = @(
        "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$Env:ProgramFiles(x86)\Docker\Docker\Docker Desktop.exe",
        "$Env:LocalAppData\Programs\Docker\Docker\Docker Desktop.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return $null
}

function Set-ImageEnv {
    param([hashtable]$Profile)
    $keys = @("PYTHON_BASE_IMAGE", "NODE_BASE_IMAGE", "POSTGRES_IMAGE", "LIBRETRANSLATE_IMAGE")

    foreach ($key in $keys) {
        if ($Profile.ContainsKey($key)) {
            Set-Item -Path ("Env:" + $key) -Value $Profile[$key]
        } else {
            Remove-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue
        }
    }
}

function Start-ComposeWithProfile {
    param(
        [string]$Name,
        [hashtable]$Profile
    )

    if ($Profile -ne $null) {
        Set-ImageEnv -Profile $Profile
        Write-Host "Trying image profile: $Name" -ForegroundColor Yellow
    } else {
        Write-Host "Trying image profile: default" -ForegroundColor Yellow
    }

    $logFile = Join-Path $env:TEMP "tvtropeszh-compose-last.log"
    if (Test-Path $logFile) {
        Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    }

    cmd /c "docker compose up --build -d 2>&1" | Tee-Object -FilePath $logFile | Out-Host
    $exitCode = $LASTEXITCODE
    if (Test-Path $logFile) {
        $script:LastComposeOutput = Get-Content -Path $logFile -Raw -ErrorAction SilentlyContinue
    }
    return ($exitCode -eq 0)
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "docker command not found. Please install Docker Desktop first."
}

if (-not (Test-DockerReady)) {
    Write-Host "Docker daemon is not ready. Attempting to start Docker Desktop..." -ForegroundColor Yellow

    $service = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -ne "Running") {
        try {
            Start-Service -Name "com.docker.service" -ErrorAction Stop
        } catch {
            Write-Host "Cannot start com.docker.service automatically. Continuing..." -ForegroundColor DarkYellow
        }
    }

    $desktopPath = Get-DockerDesktopPath
    if ($desktopPath) {
        Start-Process -FilePath $desktopPath | Out-Null
    } else {
        Write-Host "Docker Desktop executable not found automatically. Please open Docker Desktop manually." -ForegroundColor DarkYellow
    }

    $maxWaitSeconds = 180
    $stepSeconds = 5
    $elapsed = 0
    while ($elapsed -lt $maxWaitSeconds) {
        Start-Sleep -Seconds $stepSeconds
        if (Test-DockerReady) {
            break
        }
        $elapsed += $stepSeconds
        Write-Host "Waiting for Docker daemon... ${elapsed}s/${maxWaitSeconds}s"
    }

    if (-not (Test-DockerReady)) {
        Fail "Cannot connect to Docker daemon after waiting ${maxWaitSeconds}s. Please start Docker Desktop and retry."
    }
}

Write-Host "[1/3] Docker check passed" -ForegroundColor Cyan
Write-Host "[2/3] Starting services (first run may take longer)..." -ForegroundColor Cyan

$started = Start-ComposeWithProfile -Name "default" -Profile $null
if (-not $started) {
    Write-Host "Default source failed. Retrying with mirror profiles..." -ForegroundColor Yellow

    $mirrorProfiles = @(
        @{
            Name = "DaoCloud"
            PYTHON_BASE_IMAGE = "docker.m.daocloud.io/library/python:3.12-slim"
            NODE_BASE_IMAGE = "docker.m.daocloud.io/library/node:20-alpine"
            POSTGRES_IMAGE = "docker.m.daocloud.io/library/postgres:16-alpine"
            LIBRETRANSLATE_IMAGE = "docker.m.daocloud.io/libretranslate/libretranslate:latest"
        },
        @{
            Name = "DockerProxy"
            PYTHON_BASE_IMAGE = "dockerproxy.com/library/python:3.12-slim"
            NODE_BASE_IMAGE = "dockerproxy.com/library/node:20-alpine"
            POSTGRES_IMAGE = "dockerproxy.com/library/postgres:16-alpine"
            LIBRETRANSLATE_IMAGE = "dockerproxy.com/libretranslate/libretranslate:latest"
        }
    )

    foreach ($profile in $mirrorProfiles) {
        $profileName = [string]$profile["Name"]
        $activeProfile = @{}
        foreach ($key in $profile.Keys) {
            if ($key -ne "Name") {
                $activeProfile[$key] = $profile[$key]
            }
        }

        $started = Start-ComposeWithProfile -Name $profileName -Profile $activeProfile
        if ($started) {
            Write-Host "Mirror profile selected: $profileName" -ForegroundColor Green
            break
        }
    }
}

if (-not $started) {
    if ($script:LastComposeOutput -match "port is already allocated") {
        Fail "docker compose failed because a required port is occupied. Please stop the conflicting process/container and retry."
    }
    Fail "docker compose failed to start services. Docker Hub may be blocked; please retry later or configure network proxy/mirror."
}

Write-Host "[3/3] Service status" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "Started successfully." -ForegroundColor Green
Write-Host "Public UI:  http://localhost:5173"
Write-Host "Admin UI:   http://localhost:5174"
Write-Host "Backend API: http://localhost:8000"
Write-Host "Default account: admin / admin123"
Write-Host ""
Write-Host "View logs: docker compose logs -f api"
Write-Host "Stop all:  .\stop.bat"

if (-not $NoBrowser) {
    Start-Process "http://localhost:5173" | Out-Null
}
