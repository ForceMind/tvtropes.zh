from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TVTropes Zh"
    env: str = "dev"

    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432/tvtropes_zh"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    default_admin_username: str = "admin"
    default_admin_password: str = "admin123"

    default_seed_url: str = "https://tvtropes.org/pmwiki/pmwiki.php/Main/HomePage"
    default_job_interval_minutes: int = 360

    scheduler_timezone: str = "Asia/Shanghai"

    fetch_timeout_seconds: int = 20
    fetch_user_agent: str = "TVTropesZhBot/0.1 (+https://example.com/bot)"
    crawl_link_limit: int = 40
    crawl_request_interval_seconds: float = 0.8

    max_content_chars: int = 12000

    libretranslate_url: str = "http://libretranslate:5000"
    libretranslate_api_key: str = ""
    translation_timeout_seconds: int = 45

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()