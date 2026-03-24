from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.config import settings
from app.models import AdminUser, CrawlJob, CrawlRun


def ensure_default_records(db: Session) -> None:
    admin = db.query(AdminUser).filter(AdminUser.username == settings.default_admin_username).first()
    if not admin:
        db.add(
            AdminUser(
                username=settings.default_admin_username,
                password_hash=get_password_hash(settings.default_admin_password),
            )
        )

    default_job = db.query(CrawlJob).filter(CrawlJob.name == "default-homepage-job").first()
    if not default_job:
        db.add(
            CrawlJob(
                name="default-homepage-job",
                seed_url=settings.default_seed_url,
                interval_minutes=settings.default_job_interval_minutes,
                max_pages_per_run=200,
                crawl_scope="site",
                max_depth=50,
                is_active=True,
            )
        )
    else:
        # Keep legacy installs aligned with full-site crawl defaults.
        if default_job.interval_minutes > settings.default_job_interval_minutes:
            default_job.interval_minutes = settings.default_job_interval_minutes
        default_job.max_pages_per_run = max(default_job.max_pages_per_run, 200)
        default_job.crawl_scope = default_job.crawl_scope or "site"
        default_job.max_depth = default_job.max_depth or 50

    db.commit()


def finalize_interrupted_runs(db: Session) -> None:
    running_runs = db.query(CrawlRun).filter(CrawlRun.status == "running").all()
    if not running_runs:
        return

    finished_at = datetime.now(timezone.utc)
    for run in running_runs:
        run.status = "failed"
        run.error_message = "Interrupted by service restart"
        run.finished_at = finished_at

    db.commit()
