from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Translation, Trope
from app.schemas import PublicTropeDetail, PublicTropeListItem, PublicTropeListResponse

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/tropes", response_model=PublicTropeListResponse)
def list_public_tropes(
    keyword: str = Query(default="", max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PublicTropeListResponse:
    query = db.query(Trope, Translation).outerjoin(
        Translation,
        and_(Translation.trope_id == Trope.id, Translation.language == "zh-CN"),
    )

    if keyword:
        like_keyword = f"%{keyword}%"
        query = query.filter(
            or_(
                Trope.title.ilike(like_keyword),
                Trope.summary.ilike(like_keyword),
                Translation.translated_title.ilike(like_keyword),
                Translation.translated_summary.ilike(like_keyword),
            )
        )

    total = query.count()
    rows = (
        query.order_by(Trope.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items: list[PublicTropeListItem] = []
    for trope, translation in rows:
        title_zh = (translation.translated_title if translation else "") or ""
        summary_zh = (translation.translated_summary if translation else "") or ""

        items.append(
            PublicTropeListItem(
                id=trope.id,
                slug=trope.slug,
                title=title_zh if title_zh.strip() else trope.title,
                summary=summary_zh if summary_zh.strip() else trope.summary,
                has_translation=bool(translation and (translation.translated_content or translation.translated_summary)),
                updated_at=trope.updated_at,
            )
        )

    return PublicTropeListResponse(total=total, items=items)


@router.get("/tropes/{trope_id}", response_model=PublicTropeDetail)
def get_public_trope(trope_id: int, db: Session = Depends(get_db)) -> PublicTropeDetail:
    row = (
        db.query(Trope, Translation)
        .outerjoin(
            Translation,
            and_(Translation.trope_id == Trope.id, Translation.language == "zh-CN"),
        )
        .filter(Trope.id == trope_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Trope not found")

    trope, translation = row
    return PublicTropeDetail(
        id=trope.id,
        slug=trope.slug,
        tvtropes_url=trope.tvtropes_url,
        title_en=trope.title,
        summary_en=trope.summary,
        content_en=trope.content_text,
        title_zh=(translation.translated_title if translation else "") or "",
        summary_zh=(translation.translated_summary if translation else "") or "",
        content_zh=(translation.translated_content if translation else "") or "",
        translation_status=translation.status if translation else None,
        updated_at=trope.updated_at,
    )
