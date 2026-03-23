from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import CrawlJob, CrawlRun
from app.schemas import (
    CrawlJobCreateRequest,
    CrawlJobUpdateRequest,
    CrawlJobView,
    CrawlRunView,
)
from app.services.scheduler import schedule_job_now, sync_scheduler_jobs

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[CrawlJobView])
def list_jobs(db: Session = Depends(get_db), _=Depends(get_current_user)) -> list[CrawlJobView]:
    rows = db.query(CrawlJob).order_by(CrawlJob.id.asc()).all()
    return [CrawlJobView.model_validate(row) for row in rows]


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
def run_job_now(job_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)) -> dict:
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    schedule_job_now(job_id)
    return {"message": "job scheduled"}


@router.get("/runs", response_model=list[CrawlRunView])
def list_runs(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> list[CrawlRunView]:
    rows = db.query(CrawlRun).order_by(CrawlRun.started_at.desc()).limit(limit).all()
    return [CrawlRunView.model_validate(row) for row in rows]