from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CrawlFrontierUrl, CrawlJob, CrawlRun, Translation, Trope
from app.schemas import (
    PublicSiteStats,
    PublicTropeDetail,
    PublicTropeListItem,
    PublicTropeListResponse,
)

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stats", response_model=PublicSiteStats)
def get_public_stats(db: Session = Depends(get_db)) -> PublicSiteStats:
    tropes_total = db.query(func.count(Trope.id)).scalar() or 0

    translated_non_empty_filter = or_(
        func.length(func.coalesce(Translation.translated_title, "")) > 0,
        func.length(func.coalesce(Translation.translated_summary, "")) > 0,
        func.length(func.coalesce(Translation.translated_content, "")) > 0,
    )

    translated_total = (
        db.query(func.count(Translation.id))
        .filter(Translation.language == "zh-CN", translated_non_empty_filter)
        .scalar()
        or 0
    )
    reviewed_total = (
        db.query(func.count(Translation.id))
        .filter(Translation.language == "zh-CN", Translation.status == "reviewed")
        .scalar()
        or 0
    )
    stale_total = (
        db.query(func.count(Translation.id))
        .filter(Translation.language == "zh-CN", Translation.status == "stale")
        .scalar()
        or 0
    )
    machine_total = (
        db.query(func.count(Translation.id))
        .filter(Translation.language == "zh-CN", Translation.status == "machine")
        .scalar()
        or 0
    )

    active_jobs = (
        db.query(func.count(CrawlJob.id)).filter(CrawlJob.is_active.is_(True)).scalar() or 0
    )
    running_jobs = (
        db.query(func.count(func.distinct(CrawlRun.job_id)))
        .filter(CrawlRun.status == "running")
        .scalar()
        or 0
    )

    frontier_grouped = (
        db.query(CrawlFrontierUrl.status, func.count(CrawlFrontierUrl.id))
        .group_by(CrawlFrontierUrl.status)
        .all()
    )
    frontier_status = {status: int(count) for status, count in frontier_grouped}
    queue_pending = frontier_status.get("pending", 0)
    queue_processing = frontier_status.get("processing", 0)
    queue_done = frontier_status.get("done", 0)
    queue_failed = frontier_status.get("failed", 0)
    queue_total = queue_pending + queue_processing + queue_done + queue_failed

    last_run = db.query(CrawlRun).order_by(desc(CrawlRun.started_at)).first()

    coverage_rate = round((translated_total / tropes_total) * 100, 1) if tropes_total else 0.0
    reviewed_rate = (
        round((reviewed_total / translated_total) * 100, 1) if translated_total else 0.0
    )

    return PublicSiteStats(
        tropes_total=tropes_total,
        translated_total=translated_total,
        reviewed_total=reviewed_total,
        stale_total=stale_total,
        machine_total=machine_total,
        coverage_rate=coverage_rate,
        reviewed_rate=reviewed_rate,
        active_jobs=active_jobs,
        running_jobs=running_jobs,
        queue_pending=queue_pending,
        queue_processing=queue_processing,
        queue_done=queue_done,
        queue_failed=queue_failed,
        queue_total=queue_total,
        last_run_status=last_run.status if last_run else None,
        last_run_started_at=last_run.started_at if last_run else None,
        last_run_finished_at=last_run.finished_at if last_run else None,
    )


@router.get("/tropes", response_model=PublicTropeListResponse)
def list_public_tropes(
    keyword: str = Query(default="", max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PublicTropeListResponse:
    query = db.query(Trope, Translation).outerjoin(
        Translation,
        and_(Translation.trope_id == Trope.id, Translation.language == "zh-CN"),
    )

    if keyword:
        like_keyword = f"%{keyword}%"
        query = query.filter(
            or_(
                Trope.title.ilike(like_keyword),
                Trope.summary.ilike(like_keyword),
                Translation.translated_title.ilike(like_keyword),
                Translation.translated_summary.ilike(like_keyword),
            )
        )

    total = query.count()
    rows = (
        query.order_by(Trope.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items: list[PublicTropeListItem] = []
    for trope, translation in rows:
        title_zh = (translation.translated_title if translation else "") or ""
        summary_zh = (translation.translated_summary if translation else "") or ""

        items.append(
            PublicTropeListItem(
                id=trope.id,
                slug=trope.slug,
                title=title_zh if title_zh.strip() else trope.title,
                summary=summary_zh if summary_zh.strip() else trope.summary,
                has_translation=bool(translation and (translation.translated_content or translation.translated_summary)),
                updated_at=trope.updated_at,
            )
        )

    return PublicTropeListResponse(total=total, items=items)


@router.get("/tropes/{trope_id}", response_model=PublicTropeDetail)
def get_public_trope(trope_id: int, db: Session = Depends(get_db)) -> PublicTropeDetail:
    row = (
        db.query(Trope, Translation)
        .outerjoin(
            Translation,
            and_(Translation.trope_id == Trope.id, Translation.language == "zh-CN"),
        )
        .filter(Trope.id == trope_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Trope not found")

    trope, translation = row
    return PublicTropeDetail(
        id=trope.id,
        slug=trope.slug,
        tvtropes_url=trope.tvtropes_url,
        title_en=trope.title,
        summary_en=trope.summary,
        content_en=trope.content_text,
        title_zh=(translation.translated_title if translation else "") or "",
        summary_zh=(translation.translated_summary if translation else "") or "",
        content_zh=(translation.translated_content if translation else "") or "",
        translation_status=translation.status if translation else None,
        updated_at=trope.updated_at,
    )
