# TVTropes.zh (MVP)

这是一个可运行的最小版本，用于搭建 TVTropes 中文化站点后台能力：

- 全站持续抓取 TVTropes（持久化 frontier 队列）
- 原文与中文译文双存储（PostgreSQL）
- 免费机器翻译（LibreTranslate）
- 后台管理（登录、检索、译文编辑、任务监控）

## 重要说明

- 请先确认你对 TVTropes 内容的抓取、存储、翻译与再发布具备合法授权。
- 生产环境建议遵守 robots、限速、版权与站点 ToS 要求。

## 技术栈

- 后端: FastAPI + SQLAlchemy + APScheduler
- 数据库: PostgreSQL
- 翻译: LibreTranslate（自建免费服务）
- 前端: React + Vite + Ant Design
- 部署: Docker Compose

## 项目结构

```text
backend/
  app/
    main.py
    models.py
    routers/
    crawler/
    services/
frontend/
  src/
docker-compose.yml
start.bat / start.ps1
stop.bat / stop.ps1
```

## 一键运行（Windows）

直接双击项目根目录的 `start.bat`，或者在 PowerShell 执行：

```powershell
.\start.ps1
```

脚本会自动：

1. 检查 Docker 是否可用
2. 执行 `docker compose up --build -d`
3. 如果 Docker Hub 连接超时，自动重试镜像源（无需手动改文件）
4. 输出访问地址并打开前台页面

停止服务：双击 `stop.bat` 或执行：

```powershell
.\stop.ps1
```

如果你想手动指定镜像源，也可以在 `.env` 里设置：

```env
PYTHON_BASE_IMAGE=docker.m.daocloud.io/library/python:3.12-slim
NODE_BASE_IMAGE=docker.m.daocloud.io/library/node:20-alpine
POSTGRES_IMAGE=docker.m.daocloud.io/library/postgres:16-alpine
LIBRETRANSLATE_IMAGE=docker.m.daocloud.io/libretranslate/libretranslate:latest
```

## 快速启动（手动命令）

1. 启动服务

```bash
docker compose up --build
```

2. 打开页面

- 前台检索页: http://localhost:5173
- 后台管理台: http://localhost:5174
- 后端 API: http://localhost:8000

3. 默认账号

- 用户名: `admin`
- 密码: `admin123`

默认任务已配置为全站模式（`crawl_scope=site`），每轮最多处理 `200` 个 URL，运行记录与队列进度可在后台查看。

## Windows 本地调试

### 方式 A: 全部用 Docker（最简单）

```powershell
docker compose up --build
```

### 方式 B: 后端/前端本地运行（方便断点）

1. 先启动依赖服务（数据库 + 翻译）

```powershell
docker compose up -d db libretranslate
```

默认数据库映射到主机 `5433` 端口（容器内仍是 `5432`）。

2. 启动后端（PowerShell）

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5433/tvtropes_zh"
$env:LIBRETRANSLATE_URL="http://localhost:5000"
$env:CORS_ORIGINS="http://localhost:5173,http://localhost:5174"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. 启动前端（新开一个 PowerShell）

```powershell
cd frontend
npm install
$env:VITE_API_BASE_URL="http://localhost:8000"
$env:VITE_APP_MODE="public"
npm run dev -- --host 0.0.0.0 --port 5173
```

如需本地调试后台，再开一个 PowerShell：

```powershell
cd frontend
$env:VITE_API_BASE_URL="http://localhost:8000"
$env:VITE_APP_MODE="admin"
npm run dev -- --host 0.0.0.0 --port 5174
```

4. 常用调试入口

- Swagger: http://localhost:8000/docs
- 前端: http://localhost:5173

## 后端核心接口

- `POST /api/v1/auth/login` 登录
- `GET /api/v1/admin/stats` 统计
- `GET /api/v1/tropes` 条目检索
- `GET /api/v1/tropes/{id}` 条目详情
- `PUT /api/v1/tropes/{id}/translation` 译文编辑
- `GET /api/v1/jobs` 任务列表
- `POST /api/v1/jobs` 新建任务
- `PATCH /api/v1/jobs/{id}` 更新任务
- `POST /api/v1/jobs/{id}/run` 手动触发
- `GET /api/v1/jobs/{id}/progress` 队列进度
- `GET /api/v1/jobs/runs` 执行历史

## 抓取与翻译流程

1. 初始化将 `seed_url` 放入持久化队列 `crawl_frontier_urls`
2. 每次运行按 `max_pages_per_run` 从 `pending` 队列取一批 URL
3. 抓取页面并发现新链接，继续入队（`crawl_scope=site` 时持续扩展）
4. 页面提取标题、摘要、正文文本并入库 `tropes`
5. 调用 LibreTranslate 产出中文并入库 `translations`
6. 如果译文被人工审核（`reviewed`），后续原文变更会标记为 `stale`

## 生产建议

- 替换默认管理员密码和 JWT 密钥
- 给 API 增加 RBAC 与审计日志
- 将翻译服务切到离线模型或更稳定网关
- 增加对象缓存、任务队列、重试与告警
- 增加增量抓取策略（基于站点变更信号）
