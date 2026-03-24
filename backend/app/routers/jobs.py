from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import CrawlFrontierUrl, CrawlJob, CrawlRun
from app.schemas import (
    CrawlFrontierProgress,
    CrawlJobCreateRequest,
    CrawlJobUpdateRequest,
    CrawlJobView,
    CrawlRunView,
)
from app.services.scheduler import run_crawl_job_safe, sync_scheduler_jobs

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[CrawlJobView])
def list_jobs(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[CrawlJobView]:
    rows = db.query(CrawlJob).order_by(CrawlJob.id.asc()).all()
    if not rows:
        return []

    job_ids = [row.id for row in rows]
    grouped = (
        db.query(CrawlFrontierUrl.job_id, CrawlFrontierUrl.status, func.count(CrawlFrontierUrl.id))
        .filter(CrawlFrontierUrl.job_id.in_(job_ids))
        .group_by(CrawlFrontierUrl.job_id, CrawlFrontierUrl.status)
        .all()
    )
    progress_map: dict[int, dict[str, int]] = {}
    for job_id, status, count in grouped:
        progress_map.setdefault(job_id, {})[status] = int(count)

    result: list[CrawlJobView] = []
    for row in rows:
        progress = progress_map.get(row.id, {})
        payload = CrawlJobView.model_validate(row).model_dump()
        payload["pending_urls"] = progress.get("pending", 0) + progress.get("processing", 0)
        payload["done_urls"] = progress.get("done", 0)
        payload["failed_urls"] = progress.get("failed", 0)
        result.append(CrawlJobView.model_validate(payload))
    return result


@router.post("", response_model=CrawlJobView)
def create_job(
    payload: CrawlJobCreateRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> CrawlJobView:
    exists = db.query(CrawlJob).filter(CrawlJob.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="Job name already exists")

    job = CrawlJob(
        name=payload.name,
        seed_url=payload.seed_url,
        interval_minutes=payload.interval_minutes,
        max_pages_per_run=payload.max_pages_per_run,
        crawl_scope=payload.crawl_scope,
        max_depth=payload.max_depth,
        is_active=payload.is_active,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    sync_scheduler_jobs(db)
    db.refresh(job)
    return CrawlJobView.model_validate(job)


@router.patch("/{job_id}", response_model=CrawlJobView)
def update_job(
    job_id: int,
    payload: CrawlJobUpdateRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> CrawlJobView:
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(job, key, value)

    db.commit()
    db.refresh(job)

    sync_scheduler_jobs(db)
    db.refresh(job)
    return CrawlJobView.model_validate(job)


@router.post("/{job_id}/run")
def run_job_now(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> dict:
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    running = (
        db.query(CrawlRun)
        .filter(CrawlRun.job_id == job_id, CrawlRun.status == "running")
        .first()
    )
    if running:
        raise HTTPException(status_code=409, detail="Job is already running")

    # Run manual jobs out-of-band to avoid scheduler misfire edge cases.
    background_tasks.add_task(run_crawl_job_safe, job_id, True)
    return {"message": "job started"}


@router.get("/{job_id}/progress", response_model=CrawlFrontierProgress)
def job_progress(
    job_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> CrawlFrontierProgress:
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    grouped = (
        db.query(CrawlFrontierUrl.status, func.count(CrawlFrontierUrl.id))
        .filter(CrawlFrontierUrl.job_id == job_id)
        .group_by(CrawlFrontierUrl.status)
        .all()
    )
    status_map = {status: int(count) for status, count in grouped}

    pending = status_map.get("pending", 0)
    processing = status_map.get("processing", 0)
    done = status_map.get("done", 0)
    failed = status_map.get("failed", 0)
    return CrawlFrontierProgress(
        job_id=job_id,
        pending=pending,
        processing=processing,
        done=done,
        failed=failed,
        total=pending + processing + done + failed,
    )


@router.get("/runs", response_model=list[CrawlRunView])
def list_runs(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[CrawlRunView]:
    rows = db.query(CrawlRun).order_by(CrawlRun.started_at.desc()).limit(limit).all()
    return [CrawlRunView.model_validate(row) for row in rows]
