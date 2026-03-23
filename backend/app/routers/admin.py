from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import CrawlJob, CrawlRun, Translation, Trope
from app.schemas import DashboardStats

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db), _=Depends(get_current_user)) -> DashboardStats:
    tropes_total = db.query(func.count(Trope.id)).scalar() or 0
    translations_total = db.query(func.count(Translation.id)).scalar() or 0
    reviewed_total = (
        db.query(func.count(Translation.id)).filter(Translation.status == "reviewed").scalar() or 0
    )
    jobs_active = (
        db.query(func.count(CrawlJob.id)).filter(CrawlJob.is_active.is_(True)).scalar() or 0
    )

    last_run = db.query(CrawlRun).order_by(desc(CrawlRun.started_at)).first()

    return DashboardStats(
        tropes_total=tropes_total,
        translations_total=translations_total,
        reviewed_total=reviewed_total,
        jobs_active=jobs_active,
        last_run_status=last_run.status if last_run else None,
        last_run_at=last_run.started_at if last_run else None,
    )