from __future__ import annotations

import httpx

from app.config import settings
from app.crawler.parser import parse_page


class TVTropesClient:
    def __init__(self) -> None:
        self._client = httpx.Client(
            timeout=settings.fetch_timeout_seconds,
            headers={"User-Agent": settings.fetch_user_agent},
            follow_redirects=True,
        )

    def fetch_html(self, url: str) -> str:
        response = self._client.get(url)
        response.raise_for_status()
        return response.text

    def fetch_and_parse(self, url: str) -> dict:
        html = self.fetch_html(url)
        return parse_page(url=url, html=html)

    def close(self) -> None:
        self._client.close()