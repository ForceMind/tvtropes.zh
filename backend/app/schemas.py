from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DashboardStats(BaseModel):
    tropes_total: int
    translations_total: int
    reviewed_total: int
    jobs_active: int
    last_run_status: str | None
    last_run_at: datetime | None


class TranslationView(BaseModel):
    id: int
    language: str
    translated_title: str
    translated_summary: str
    translated_content: str
    status: str
    translator: str
    updated_by: str | None
    updated_at: datetime

    class Config:
        from_attributes = True


class TropeListItem(BaseModel):
    id: int
    tvtropes_url: str
    slug: str
    title: str
    summary: str
    fetched_at: datetime
    translation_status: str | None = None


class TropeDetail(BaseModel):
    id: int
    tvtropes_url: str
    slug: str
    title: str
    summary: str
    content_text: str
    fetched_at: datetime
    updated_at: datetime
    translation: TranslationView | None = None


class TropeListResponse(BaseModel):
    total: int
    items: list[TropeListItem]


class TranslationUpdateRequest(BaseModel):
    translated_title: str = Field(default="")
    translated_summary: str = Field(default="")
    translated_content: str = Field(default="")
    status: str = Field(default="reviewed")


class CrawlJobCreateRequest(BaseModel):
    name: str
    seed_url: str
    interval_minutes: int = Field(default=30, ge=5, le=1440)
    max_pages_per_run: int = Field(default=200, ge=1, le=2000)
    crawl_scope: Literal["site", "seed"] = Field(default="site")
    max_depth: int = Field(default=50, ge=1, le=500)
    is_active: bool = True


class CrawlJobUpdateRequest(BaseModel):
    name: str | None = None
    seed_url: str | None = None
    interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    max_pages_per_run: int | None = Field(default=None, ge=1, le=2000)
    crawl_scope: Literal["site", "seed"] | None = None
    max_depth: int | None = Field(default=None, ge=1, le=500)
    is_active: bool | None = None


class CrawlJobView(BaseModel):
    id: int
    name: str
    seed_url: str
    interval_minutes: int
    max_pages_per_run: int
    crawl_scope: str
    max_depth: int
    is_active: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    pending_urls: int = 0
    done_urls: int = 0
    failed_urls: int = 0

    class Config:
        from_attributes = True


class CrawlRunView(BaseModel):
    id: int
    job_id: int
    status: str
    items_found: int
    items_saved: int
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None

    class Config:
        from_attributes = True


class CrawlFrontierProgress(BaseModel):
    job_id: int
    pending: int
    done: int
    failed: int
    processing: int
    total: int


class PublicTropeListItem(BaseModel):
    id: int
    slug: str
    title: str
    summary: str
    has_translation: bool
    updated_at: datetime


class PublicTropeListResponse(BaseModel):
    total: int
    items: list[PublicTropeListItem]


class PublicTropeDetail(BaseModel):
    id: int
    slug: str
    tvtropes_url: str
    title_en: str
    summary_en: str
    content_en: str
    title_zh: str
    summary_zh: str
    content_zh: str
    translation_status: str | None = None
    updated_at: datetime


class PublicSiteStats(BaseModel):
    tropes_total: int
    translated_total: int
    reviewed_total: int
    stale_total: int
    machine_total: int
    coverage_rate: float
    reviewed_rate: float
    active_jobs: int
    running_jobs: int
    queue_pending: int
    queue_processing: int
    queue_done: int
    queue_failed: int
    queue_total: int
    last_run_status: str | None
    last_run_started_at: datetime | None
    last_run_finished_at: datetime | None
