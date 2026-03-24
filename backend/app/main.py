import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.bootstrap import ensure_default_records, finalize_interrupted_runs
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.routers import admin, auth, health, jobs, public, tropes
from app.services.scheduler import start_scheduler, stop_scheduler, sync_scheduler_jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(tropes.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(public.router, prefix="/api/v1")


def _apply_lightweight_schema_updates() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())

        if "crawl_jobs" in tables:
            columns = {column["name"] for column in inspector.get_columns("crawl_jobs")}
            if "crawl_scope" not in columns:
                conn.execute(
                    text(
                        "ALTER TABLE crawl_jobs "
                        "ADD COLUMN crawl_scope VARCHAR(24) NOT NULL DEFAULT 'site'"
                    )
                )
            if "max_depth" not in columns:
                conn.execute(
                    text("ALTER TABLE crawl_jobs ADD COLUMN max_depth INTEGER NOT NULL DEFAULT 50")
                )

            conn.execute(
                text(
                    "UPDATE crawl_jobs "
                    "SET crawl_scope='site' "
                    "WHERE crawl_scope IS NULL OR crawl_scope=''"
                )
            )
            conn.execute(
                text("UPDATE crawl_jobs SET max_depth=50 WHERE max_depth IS NULL OR max_depth < 1")
            )

            conn.execute(
                text(
                    "UPDATE crawl_jobs "
                    "SET max_pages_per_run = 200 "
                    "WHERE max_pages_per_run IS NULL OR max_pages_per_run < 1"
                )
            )


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_schema_updates()
    db = SessionLocal()
    try:
        finalize_interrupted_runs(db)
        ensure_default_records(db)
        start_scheduler()
        sync_scheduler_jobs(db)
    finally:
        db.close()


@app.on_event("shutdown")
def on_shutdown() -> None:
    stop_scheduler()
