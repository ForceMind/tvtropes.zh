from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.config import settings
from app.crawler.client import TVTropesClient
from app.db import SessionLocal
from app.models import CrawlJob, CrawlRun, Translation, Trope
from app.services.translation import LibreTranslateService

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone=settings.scheduler_timezone)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_slug(url: str, title: str) -> str:
    base = title or url.rstrip("/").split("/")[-1]
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", base).strip("-").lower()
    return slug or hashlib.md5(url.encode("utf-8")).hexdigest()[:12]


def _source_hash(title: str, summary: str, content_text: str) -> str:
    raw = f"{title}\n{summary}\n{content_text}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _job_id(job_id: int) -> str:
    return f"crawl_job_{job_id}"


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def sync_scheduler_jobs(db: Session) -> None:
    existing_job_ids = {job.id for job in scheduler.get_jobs() if job.id.startswith("crawl_job_")}

    jobs = db.query(CrawlJob).all()
    active_ids: set[str] = set()

    for crawl_job in jobs:
        job_id = _job_id(crawl_job.id)
        if crawl_job.is_active:
            scheduler.add_job(
                run_crawl_job_safe,
                trigger="interval",
                minutes=crawl_job.interval_minutes,
                id=job_id,
                replace_existing=True,
                args=[crawl_job.id],
                coalesce=True,
                max_instances=1,
            )
            active_ids.add(job_id)
        else:
            if scheduler.get_job(job_id):
                scheduler.remove_job(job_id)

    for orphan_id in existing_job_ids - active_ids:
        if scheduler.get_job(orphan_id):
            scheduler.remove_job(orphan_id)

    for crawl_job in jobs:
        scheduled = scheduler.get_job(_job_id(crawl_job.id))
        crawl_job.next_run_at = scheduled.next_run_time if scheduled else None
    db.commit()


def schedule_job_now(job_id: int) -> None:
    run_id = f"manual_{job_id}_{int(time.time())}"
    scheduler.add_job(
        run_crawl_job_safe,
        trigger="date",
        run_date=datetime.now(),
        id=run_id,
        args=[job_id],
    )


def run_crawl_job_safe(job_id: int) -> None:
    db = SessionLocal()
    try:
        execute_crawl_job(db=db, job_id=job_id)
    except Exception:
        logger.exception("crawl job %s failed unexpectedly", job_id)
    finally:
        db.close()


def execute_crawl_job(db: Session, job_id: int) -> CrawlRun | None:
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id, CrawlJob.is_active.is_(True)).first()
    if not job:
        return None

    run = CrawlRun(
        job_id=job.id,
        status="running",
        items_found=0,
        items_saved=0,
        started_at=_utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    crawler = TVTropesClient()
    translator = LibreTranslateService()

    try:
        parsed_seed = crawler.fetch_and_parse(job.seed_url)
        candidate_urls = [job.seed_url] + [
            url for url in parsed_seed["links"] if url != job.seed_url
        ]
        candidate_urls = candidate_urls[: job.max_pages_per_run]

        run.items_found = len(candidate_urls)
        db.commit()

        for index, target_url in enumerate(candidate_urls):
            parsed = parsed_seed if index == 0 else crawler.fetch_and_parse(target_url)

            title = parsed.get("title", "")
            summary = parsed.get("summary", "")
            content_text = parsed.get("content_text", "")
            source_hash = _source_hash(title, summary, content_text)
            slug = _normalize_slug(target_url, title)

            trope = db.query(Trope).filter(Trope.tvtropes_url == target_url).first()
            if not trope:
                trope = Trope(
                    tvtropes_url=target_url,
                    slug=slug,
                    title=title,
                    summary=summary,
                    content_text=content_text,
                    source_hash=source_hash,
                    fetched_at=_utcnow(),
                )
                db.add(trope)
                db.flush()
                run.items_saved += 1
            else:
                changed = trope.source_hash != source_hash
                trope.slug = slug
                trope.title = title
                trope.summary = summary
                trope.content_text = content_text
                trope.source_hash = source_hash
                trope.fetched_at = _utcnow()
                if changed:
                    run.items_saved += 1

            translation = (
                db.query(Translation)
                .filter(Translation.trope_id == trope.id, Translation.language == "zh-CN")
                .first()
            )

            if not translation:
                translated_title, translated_summary, translated_content = translator.translate_bundle(
                    title=title,
                    summary=summary,
                    content=content_text,
                )
                translation = Translation(
                    trope_id=trope.id,
                    language="zh-CN",
                    translated_title=translated_title,
                    translated_summary=translated_summary,
                    translated_content=translated_content,
                    source_hash=source_hash,
                    status="machine",
                    translator="libretranslate",
                    updated_by="system",
                )
                db.add(translation)
            else:
                if translation.source_hash != source_hash:
                    if translation.status == "reviewed":
                        translation.status = "stale"
                    else:
                        (
                            translation.translated_title,
                            translation.translated_summary,
                            translation.translated_content,
                        ) = translator.translate_bundle(
                            title=title,
                            summary=summary,
                            content=content_text,
                        )
                        translation.source_hash = source_hash
                        translation.status = "machine"
                        translation.translator = "libretranslate"
                        translation.updated_by = "system"

            db.commit()
            time.sleep(settings.crawl_request_interval_seconds)

        run.status = "success"
        run.finished_at = _utcnow()
        job.last_run_at = run.finished_at
        db.commit()
    except Exception as exc:
        logger.exception("crawl run failed for job=%s", job.id)
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = _utcnow()
        job.last_run_at = run.finished_at
        db.commit()
    finally:
        crawler.close()
        translator.close()

    scheduled = scheduler.get_job(_job_id(job.id))
    job.next_run_at = scheduled.next_run_time if scheduled else None
    db.commit()

    db.refresh(run)
    return run