from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.config import settings

_PAGE_PATH_FRAGMENT = "/pmwiki/pmwiki.php/"
_INVALID_LINK_TOKENS = [
    "action=edit",
    "action=history",
    "action=print",
    "?from=",
    "Main/Random",
]


def _clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value


def parse_page(url: str, html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    for selector in ["script", "style", "noscript", "header", "footer", "nav", "aside"]:
        for node in soup.select(selector):
            node.decompose()

    main = soup.select_one("#main-article") or soup.select_one("main") or soup.body or soup
    title_node = main.find("h1") or soup.find("h1")
    title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
    if not title and soup.title:
        title = _clean_text(soup.title.get_text(" ", strip=True).replace(" - TV Tropes", ""))

    paragraphs: list[str] = []
    for node in main.find_all(["p", "li"]):
        text = _clean_text(node.get_text(" ", strip=True))
        if len(text) < 20:
            continue
        paragraphs.append(text)

    summary = paragraphs[0] if paragraphs else ""
    content_text = "\n\n".join(paragraphs)
    if len(content_text) > settings.max_content_chars:
        content_text = content_text[: settings.max_content_chars]

    return {
        "url": url,
        "title": title or "Untitled",
        "summary": summary,
        "content_text": content_text,
        "links": discover_links(url, soup),
    }


def discover_links(base_url: str, soup: BeautifulSoup) -> list[str]:
    base = urlparse(base_url)
    links: list[str] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href:
            continue

        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)

        if parsed.netloc and parsed.netloc != base.netloc:
            continue
        if _PAGE_PATH_FRAGMENT not in parsed.path:
            continue
        if any(token in absolute for token in _INVALID_LINK_TOKENS):
            continue

        normalized = parsed._replace(fragment="", query="").geturl()
        if normalized in seen:
            continue

        seen.add(normalized)
        links.append(normalized)
        if len(links) >= settings.crawl_link_limit:
            break

    return links