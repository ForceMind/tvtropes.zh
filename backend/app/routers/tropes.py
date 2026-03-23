from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Translation, Trope
from app.schemas import (
    TranslationUpdateRequest,
    TranslationView,
    TropeDetail,
    TropeListItem,
    TropeListResponse,
)

router = APIRouter(prefix="/tropes", tags=["tropes"])


@router.get("", response_model=TropeListResponse)
def list_tropes(
    keyword: str = Query(default="", max_length=120),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
) -> TropeListResponse:
    query = db.query(Trope)

    if keyword:
        like_keyword = f"%{keyword}%"
        query = query.filter(
            or_(Trope.title.ilike(like_keyword), Trope.summary.ilike(like_keyword))
        )

    if status:
        query = query.join(
            Translation,
            (Translation.trope_id == Trope.id) & (Translation.language == "zh-CN"),
        ).filter(Translation.status == status)

    total = query.count()
    items = (
        query.order_by(Trope.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    trope_ids = [item.id for item in items]
    translation_map: dict[int, str] = {}
    if trope_ids:
        rows = (
            db.query(Translation)
            .filter(Translation.trope_id.in_(trope_ids), Translation.language == "zh-CN")
            .all()
        )
        translation_map = {row.trope_id: row.status for row in rows}

    return TropeListResponse(
        total=total,
        items=[
            TropeListItem(
                id=item.id,
                tvtropes_url=item.tvtropes_url,
                slug=item.slug,
                title=item.title,
                summary=item.summary,
                fetched_at=item.fetched_at,
                translation_status=translation_map.get(item.id),
            )
            for item in items
        ],
    )


@router.get("/{trope_id}", response_model=TropeDetail)
def get_trope(
    trope_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
) -> TropeDetail:
    trope = db.query(Trope).filter(Trope.id == trope_id).first()
    if not trope:
        raise HTTPException(status_code=404, detail="Trope not found")

    translation = (
        db.query(Translation)
        .filter(Translation.trope_id == trope.id, Translation.language == "zh-CN")
        .first()
    )

    return TropeDetail(
        id=trope.id,
        tvtropes_url=trope.tvtropes_url,
        slug=trope.slug,
        title=trope.title,
        summary=trope.summary,
        content_text=trope.content_text,
        fetched_at=trope.fetched_at,
        updated_at=trope.updated_at,
        translation=TranslationView.model_validate(translation) if translation else None,
    )


@router.put("/{trope_id}/translation", response_model=TranslationView)
def update_translation(
    trope_id: int,
    payload: TranslationUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> TranslationView:
    trope = db.query(Trope).filter(Trope.id == trope_id).first()
    if not trope:
        raise HTTPException(status_code=404, detail="Trope not found")

    translation = (
        db.query(Translation)
        .filter(Translation.trope_id == trope.id, Translation.language == "zh-CN")
        .first()
    )

    if not translation:
        translation = Translation(
            trope_id=trope.id,
            language="zh-CN",
            translated_title=payload.translated_title,
            translated_summary=payload.translated_summary,
            translated_content=payload.translated_content,
            source_hash=trope.source_hash,
            status=payload.status,
            translator="manual",
            updated_by=current_user.username,
        )
        db.add(translation)
    else:
        translation.translated_title = payload.translated_title
        translation.translated_summary = payload.translated_summary
        translation.translated_content = payload.translated_content
        translation.status = payload.status
        translation.source_hash = trope.source_hash
        translation.translator = "manual"
        translation.updated_by = current_user.username

    db.commit()
    db.refresh(translation)
    return TranslationView.model_validate(translation)