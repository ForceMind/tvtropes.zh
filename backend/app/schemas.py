from datetime import datetime

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
    interval_minutes: int = Field(default=360, ge=5, le=1440)
    max_pages_per_run: int = Field(default=20, ge=1, le=100)
    is_active: bool = True


class CrawlJobUpdateRequest(BaseModel):
    name: str | None = None
    seed_url: str | None = None
    interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    max_pages_per_run: int | None = Field(default=None, ge=1, le=100)
    is_active: bool | None = None


class CrawlJobView(BaseModel):
    id: int
    name: str
    seed_url: str
    interval_minutes: int
    max_pages_per_run: int
    is_active: bool
    last_run_at: datetime | None
    next_run_at: datetime | None

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