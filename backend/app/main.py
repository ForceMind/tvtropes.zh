import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.bootstrap import ensure_default_records
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.routers import admin, auth, health, jobs, tropes
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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_default_records(db)
        start_scheduler()
        sync_scheduler_jobs(db)
    finally:
        db.close()


@app.on_event("shutdown")
def on_shutdown() -> None:
    stop_scheduler()