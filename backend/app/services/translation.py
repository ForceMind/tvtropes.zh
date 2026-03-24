from __future__ import annotations

import logging
import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LibreTranslateService:
    def __init__(self) -> None:
        self._client = httpx.Client(
            timeout=settings.translation_timeout_seconds,
        )

    def wait_until_ready(self, timeout_seconds: int = 120, interval_seconds: int = 3) -> bool:
        endpoint = settings.libretranslate_url.rstrip("/") + "/languages"
        deadline = time.time() + timeout_seconds

        while time.time() < deadline:
            try:
                response = self._client.get(endpoint)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and data:
                        return True
            except Exception:
                pass
            time.sleep(interval_seconds)
        return False

    def _translate_chunk(self, text: str, source: str, target: str) -> str:
        payload = {
            "q": text,
            "source": source,
            "target": target,
            "format": "text",
        }
        if settings.libretranslate_api_key:
            payload["api_key"] = settings.libretranslate_api_key

        endpoint = settings.libretranslate_url.rstrip("/") + "/translate"
        last_error: Exception | None = None
        for attempt in range(4):
            try:
                # Most LibreTranslate deployments expect x-www-form-urlencoded.
                response = self._client.post(endpoint, data=payload)
                if response.status_code >= 400:
                    # Compatibility fallback for deployments that only accept JSON.
                    response = self._client.post(endpoint, json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("translatedText", text)
            except Exception as exc:
                last_error = exc
                if attempt < 3:
                    time.sleep(1.5 * (attempt + 1))
                continue

        raise RuntimeError(f"translate request failed after retries: {last_error}")

    def translate_text(self, text: str, source: str = "en", target: str = "zh") -> str:
        if not text.strip():
            return ""

        try:
            if len(text) <= 1800:
                return self._translate_chunk(text, source, target)

            # Split long input into medium chunks to avoid service limits.
            chunks: list[str] = []
            buffer = []
            current_size = 0
            for block in text.split("\n\n"):
                candidate = block.strip()
                if not candidate:
                    continue
                if current_size + len(candidate) > 1600 and buffer:
                    chunks.append("\n\n".join(buffer))
                    buffer = [candidate]
                    current_size = len(candidate)
                else:
                    buffer.append(candidate)
                    current_size += len(candidate)
            if buffer:
                chunks.append("\n\n".join(buffer))

            translated_parts = [
                self._translate_chunk(chunk, source=source, target=target) for chunk in chunks
            ]
            return "\n\n".join(translated_parts)
        except Exception as exc:
            logger.warning("translation failed, fallback to source text: %s", exc)
            return text

    def translate_bundle(self, title: str, summary: str, content: str) -> tuple[str, str, str]:
        return (
            self.translate_text(title),
            self.translate_text(summary),
            self.translate_text(content),
        )

    def close(self) -> None:
        self._client.close()
