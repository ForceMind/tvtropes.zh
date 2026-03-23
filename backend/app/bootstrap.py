from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.config import settings
from app.models import AdminUser, CrawlJob


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
                max_pages_per_run=12,
                is_active=True,
            )
        )

    db.commit()