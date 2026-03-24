from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.config import settings
from app.crawler.client import TVTropesClient
from app.db import SessionLocal
from app.models import CrawlFrontierUrl, CrawlJob, CrawlRun, Translation, Trope
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


def _norm_for_compare(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().lower()


def _looks_untranslated(translation: Translation, title: str, summary: str, content_text: str) -> bool:
    if translation.status == "reviewed":
        return False

    same_title = _norm_for_compare(translation.translated_title) == _norm_for_compare(title)
    same_summary = _norm_for_compare(translation.translated_summary) == _norm_for_compare(summary)
    same_content = _norm_for_compare(translation.translated_content) == _norm_for_compare(content_text)
    return (same_title and same_summary) or same_content


def _normalize_frontier_url(url: str) -> str:
    parsed = urlparse((url or "").strip())
    normalized = parsed._replace(query="", fragment="").geturl()
    return normalized.rstrip("/")


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
    run_date = datetime.now(ZoneInfo(settings.scheduler_timezone))
    scheduler.add_job(
        run_crawl_job_safe,
        trigger="date",
        run_date=run_date,
        id=run_id,
        args=[job_id, True],
    )


def run_crawl_job_safe(job_id: int, allow_inactive: bool = False) -> None:
    db = SessionLocal()
    try:
        execute_crawl_job(db=db, job_id=job_id, allow_inactive=allow_inactive)
    except Exception:
        logger.exception("crawl job %s failed unexpectedly", job_id)
    finally:
        db.close()


def _ensure_seed_frontier(db: Session, job: CrawlJob) -> None:
    seed_url = _normalize_frontier_url(job.seed_url)
    if not seed_url:
        return

    job.seed_url = seed_url
    existing = (
        db.query(CrawlFrontierUrl)
        .filter(CrawlFrontierUrl.job_id == job.id, CrawlFrontierUrl.url == seed_url)
        .first()
    )
    if not existing:
        db.add(
            CrawlFrontierUrl(
                job_id=job.id,
                url=seed_url,
                depth=0,
                status="pending",
                discovered_from=None,
            )
        )
    db.commit()


def _enqueue_frontier(db: Session, job: CrawlJob, url: str, depth: int, discovered_from: str) -> None:
    if depth > job.max_depth:
        return

    normalized = _normalize_frontier_url(url)
    if not normalized:
        return

    exists = (
        db.query(CrawlFrontierUrl)
        .filter(CrawlFrontierUrl.job_id == job.id, CrawlFrontierUrl.url == normalized)
        .first()
    )
    if exists:
        return

    db.add(
        CrawlFrontierUrl(
            job_id=job.id,
            url=normalized,
            depth=depth,
            status="pending",
            discovered_from=discovered_from,
        )
    )


def _upsert_trope_and_translation(
    db: Session,
    translator: LibreTranslateService,
    target_url: str,
    parsed: dict,
) -> bool:
    title = parsed.get("title", "")
    summary = parsed.get("summary", "")
    content_text = parsed.get("content_text", "")
    source_hash = _source_hash(title, summary, content_text)
    slug = _normalize_slug(target_url, title)

    changed = False
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
        changed = True
    else:
        source_changed = trope.source_hash != source_hash
        trope.slug = slug
        trope.title = title
        trope.summary = summary
        trope.content_text = content_text
        trope.source_hash = source_hash
        trope.fetched_at = _utcnow()
        changed = source_changed

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
        should_retry_failed_machine = _looks_untranslated(
            translation, title=title, summary=summary, content_text=content_text
        )
        if translation.source_hash != source_hash or should_retry_failed_machine:
            if translation.status == "reviewed" and translation.source_hash != source_hash:
                translation.status = "stale"
                translation.source_hash = source_hash
                translation.updated_by = "system"
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

    return changed


def _execute_seed_only_job(
    db: Session,
    job: CrawlJob,
    run: CrawlRun,
    crawler: TVTropesClient,
    translator: LibreTranslateService,
) -> tuple[int, int]:
    failed_count = 0
    saved_count = 0

    parsed_seed = crawler.fetch_and_parse(job.seed_url)
    candidate_urls = [job.seed_url] + [url for url in parsed_seed["links"] if url != job.seed_url]
    candidate_urls = candidate_urls[: job.max_pages_per_run]

    run.items_found = len(candidate_urls)
    db.commit()

    for index, target_url in enumerate(candidate_urls):
        try:
            parsed = parsed_seed if index == 0 else crawler.fetch_and_parse(target_url)
            if _upsert_trope_and_translation(db=db, translator=translator, target_url=target_url, parsed=parsed):
                saved_count += 1
            db.commit()
        except Exception as exc:
            failed_count += 1
            db.rollback()
            logger.warning("crawl url failed in seed mode job=%s url=%s err=%s", job.id, target_url, exc)
        finally:
            time.sleep(settings.crawl_request_interval_seconds)

    return saved_count, failed_count


def _execute_site_scope_job(
    db: Session,
    job: CrawlJob,
    run: CrawlRun,
    crawler: TVTropesClient,
    translator: LibreTranslateService,
) -> tuple[int, int]:
    _ensure_seed_frontier(db, job)

    frontier_items = (
        db.query(CrawlFrontierUrl)
        .filter(
            CrawlFrontierUrl.job_id == job.id,
            CrawlFrontierUrl.status == "pending",
            CrawlFrontierUrl.depth <= job.max_depth,
        )
        .order_by(CrawlFrontierUrl.id.asc())
        .limit(job.max_pages_per_run)
        .all()
    )

    run.items_found = len(frontier_items)
    db.commit()

    if not frontier_items:
        return 0, 0

    for item in frontier_items:
        item.status = "processing"
    db.commit()

    failed_count = 0
    saved_count = 0

    for item in frontier_items:
        try:
            parsed = crawler.fetch_and_parse(item.url)
            if _upsert_trope_and_translation(
                db=db,
                translator=translator,
                target_url=item.url,
                parsed=parsed,
            ):
                saved_count += 1

            for link in parsed.get("links", []):
                _enqueue_frontier(
                    db=db,
                    job=job,
                    url=link,
                    depth=item.depth + 1,
                    discovered_from=item.url,
                )

            item.status = "done"
            item.last_error = None
            item.last_crawled_at = _utcnow()
            db.commit()
        except Exception as exc:
            failed_count += 1
            db.rollback()
            refresh_item = db.query(CrawlFrontierUrl).filter(CrawlFrontierUrl.id == item.id).first()
            if refresh_item:
                refresh_item.retries += 1
                refresh_item.last_error = str(exc)
                refresh_item.last_crawled_at = _utcnow()
                refresh_item.status = "pending" if refresh_item.retries < 3 else "failed"
                db.commit()
            logger.warning("crawl url failed in site scope job=%s url=%s err=%s", job.id, item.url, exc)
        finally:
            time.sleep(settings.crawl_request_interval_seconds)

    return saved_count, failed_count


def execute_crawl_job(db: Session, job_id: int, allow_inactive: bool = False) -> CrawlRun | None:
    query = db.query(CrawlJob).filter(CrawlJob.id == job_id)
    if not allow_inactive:
        query = query.filter(CrawlJob.is_active.is_(True))
    job = query.first()
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
        if not translator.wait_until_ready():
            raise RuntimeError("translation service not ready")

        if job.crawl_scope == "site":
            saved_count, failed_count = _execute_site_scope_job(
                db=db, job=job, run=run, crawler=crawler, translator=translator
            )
        else:
            saved_count, failed_count = _execute_seed_only_job(
                db=db, job=job, run=run, crawler=crawler, translator=translator
            )

        run.items_saved = saved_count
        run.status = "success" if failed_count == 0 else "partial"
        run.error_message = f"{failed_count} urls failed in this run" if failed_count else None
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
