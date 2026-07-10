"""Official campus admin console APIs."""
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app import models
from app.marketplace import (
    create_notification,
    get_current_user,
    get_db,
    user_payload,
    compute_trust,
)

router = APIRouter(prefix="/marketplace/admin", tags=["campus-admin"])


def require_admin(user: models.User = Depends(get_current_user)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


class ContentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=3000)
    content: Optional[str] = Field(default=None, max_length=3000)
    status: Optional[str] = Field(default=None, max_length=30)
    price: Optional[Decimal] = Field(default=None, gt=0)


class ReportHandle(BaseModel):
    status: Literal["resolved", "dismissed", "pending"] = "resolved"
    action: Literal["none", "warn", "ban_comment", "ban_post", "ban_both", "trust_penalty", "disable_user"] = "none"
    admin_note: Optional[str] = Field(default=None, max_length=500)
    trust_delta: Optional[int] = Field(default=None, ge=-200, le=0)


class UserPenaltyUpdate(BaseModel):
    can_comment: Optional[bool] = None
    can_post: Optional[bool] = None
    is_active: Optional[bool] = None
    ban_reason: Optional[str] = Field(default=None, max_length=240)
    trust_delta: Optional[int] = Field(default=None, ge=-300, le=300)
    trust_note: Optional[str] = Field(default=None, max_length=200)


class OfficialNoticeCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    content: str = Field(min_length=2, max_length=500)
    recipient_user_id: Optional[int] = None
    broadcast: bool = False


CONTENT_LABELS = {
    "listing": "二手商品",
    "service": "跑腿任务",
    "wanted": "求购",
    "community": "社区帖",
}


def content_row_payload(item_type: str, item):
    if item_type == "listing":
        return {
            "id": item.id,
            "type": "listing" if item.trade_type != "digital" else "game",
            "title": item.title,
            "description": item.description,
            "status": item.status,
            "price_label": f"¥{float(item.price):.0f}",
            "author_id": item.seller_id,
            "created_at": item.created_at,
            "image_url": item.images[0].image_url if getattr(item, "images", None) else None,
        }
    if item_type == "service":
        return {
            "id": item.id,
            "type": "service",
            "title": item.title,
            "description": item.description,
            "status": item.status,
            "price_label": f"赏金 ¥{float(item.reward):.0f}",
            "author_id": item.requester_id,
            "created_at": item.created_at,
            "image_url": item.image_url,
        }
    if item_type == "wanted":
        return {
            "id": item.id,
            "type": "wanted",
            "title": item.title,
            "description": item.description,
            "status": item.status,
            "price_label": f"预算 ¥{float(item.budget_max):.0f}" if item.budget_max else "预算面议",
            "author_id": item.user_id,
            "created_at": item.created_at,
            "image_url": item.image_url,
        }
    return {
        "id": item.id,
        "type": "community",
        "title": item.title or (item.content[:40] if item.content else "社区帖"),
        "description": item.content,
        "status": item.topic,
        "price_label": None,
        "author_id": item.author_id,
        "created_at": item.created_at,
        "image_url": item.image_url,
    }


def delete_content_row(db: Session, item_type: str, item_id: int):
    if item_type in {"listing", "game"}:
        item = db.get(models.Listing, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="内容不存在")
        db.delete(item)
        return
    if item_type == "service":
        item = db.get(models.ServiceTask, item_id)
    elif item_type == "wanted":
        item = db.get(models.WantedPost, item_id)
    elif item_type == "community":
        item = db.get(models.CommunityPost, item_id)
    else:
        raise HTTPException(status_code=400, detail="不支持的内容类型")
    if not item:
        raise HTTPException(status_code=404, detail="内容不存在")
    db.delete(item)


@router.get("/overview")
def admin_overview(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    return {
        "users": db.query(models.User).count(),
        "active_listings": db.query(models.Listing).filter(models.Listing.status == "available").count(),
        "open_tasks": db.query(models.ServiceTask).filter(models.ServiceTask.status == "open").count(),
        "pending_reports": db.query(models.Report).filter(models.Report.status == "pending").count(),
        "orders": db.query(models.Order).count(),
        "community_posts": db.query(models.CommunityPost).count(),
        "wanted_posts": db.query(models.WantedPost).count(),
    }


@router.get("/contents")
def admin_list_contents(
    content_type: str = Query(default="all"),
    keyword: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    items = []
    keyword = keyword.strip()
    if content_type in {"all", "listing", "game"}:
        query = db.query(models.Listing).options(joinedload(models.Listing.images))
        if content_type == "game":
            query = query.filter(models.Listing.trade_type == "digital")
        elif content_type == "listing":
            query = query.filter(models.Listing.trade_type != "digital")
        if keyword:
            query = query.filter(or_(models.Listing.title.contains(keyword), models.Listing.description.contains(keyword)))
        for row in query.order_by(models.Listing.created_at.desc()).limit(limit).all():
            items.append(content_row_payload("listing", row))
    if content_type in {"all", "service"}:
        query = db.query(models.ServiceTask)
        if keyword:
            query = query.filter(or_(models.ServiceTask.title.contains(keyword), models.ServiceTask.description.contains(keyword)))
        for row in query.order_by(models.ServiceTask.created_at.desc()).limit(limit).all():
            items.append(content_row_payload("service", row))
    if content_type in {"all", "wanted"}:
        query = db.query(models.WantedPost)
        if keyword:
            query = query.filter(or_(models.WantedPost.title.contains(keyword), models.WantedPost.description.contains(keyword)))
        for row in query.order_by(models.WantedPost.created_at.desc()).limit(limit).all():
            items.append(content_row_payload("wanted", row))
    if content_type in {"all", "community"}:
        query = db.query(models.CommunityPost)
        if keyword:
            query = query.filter(or_(models.CommunityPost.title.contains(keyword), models.CommunityPost.content.contains(keyword)))
        for row in query.order_by(models.CommunityPost.created_at.desc()).limit(limit).all():
            items.append(content_row_payload("community", row))
    items.sort(key=lambda item: item.get("created_at") or datetime.min, reverse=True)
    author_ids = {item["author_id"] for item in items if item.get("author_id")}
    authors = {
        user.id: user_payload(user)
        for user in db.query(models.User).options(joinedload(models.User.profile)).filter(models.User.id.in_(author_ids or [-1])).all()
    }
    for item in items:
        item["author"] = authors.get(item.get("author_id"))
        item["type_label"] = CONTENT_LABELS.get(item["type"] if item["type"] != "game" else "listing", item["type"])
    return {"items": items[:limit]}


@router.put("/contents/{content_type}/{content_id}")
def admin_update_content(
    content_type: str,
    content_id: int,
    data: ContentUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if content_type in {"listing", "game"}:
        item = db.get(models.Listing, content_id)
        if not item:
            raise HTTPException(status_code=404, detail="商品不存在")
        if data.title is not None:
            item.title = data.title
        if data.description is not None:
            item.description = data.description
        if data.status is not None:
            item.status = data.status
        if data.price is not None:
            item.price = data.price
    elif content_type == "service":
        item = db.get(models.ServiceTask, content_id)
        if not item:
            raise HTTPException(status_code=404, detail="任务不存在")
        if data.title is not None:
            item.title = data.title
        if data.description is not None:
            item.description = data.description
        if data.status is not None:
            item.status = data.status
        if data.price is not None:
            item.reward = data.price
    elif content_type == "wanted":
        item = db.get(models.WantedPost, content_id)
        if not item:
            raise HTTPException(status_code=404, detail="求购不存在")
        if data.title is not None:
            item.title = data.title
        if data.description is not None:
            item.description = data.description
        if data.status is not None:
            item.status = data.status
    elif content_type == "community":
        item = db.get(models.CommunityPost, content_id)
        if not item:
            raise HTTPException(status_code=404, detail="帖子不存在")
        if data.title is not None:
            item.title = data.title
        if data.content is not None or data.description is not None:
            item.content = data.content or data.description
    else:
        raise HTTPException(status_code=400, detail="不支持的内容类型")
    db.commit()
    return {"message": "内容已更新"}


@router.delete("/contents/{content_type}/{content_id}")
def admin_delete_content(
    content_type: str,
    content_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    delete_content_row(db, content_type, content_id)
    db.commit()
    return {"message": "内容已删除"}


@router.get("/reports")
def admin_list_reports(
    status: str = Query(default="all"),
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = db.query(models.Report).options(
        joinedload(models.Report.reporter).joinedload(models.User.profile),
    ).order_by(models.Report.created_at.desc())
    if status != "all":
        query = query.filter(models.Report.status == status)
    rows = query.limit(limit).all()
    items = []
    for row in rows:
        target_owner_id = None
        target_title = f"{row.target_type}#{row.target_id}"
        if row.target_type == "user":
            target = db.get(models.User, row.target_id)
            target_owner_id = row.target_id
            target_title = (target.username if target else target_title)
        elif row.target_type == "comment":
            comment = db.get(models.ContentComment, row.target_id)
            target_owner_id = comment.user_id if comment else None
            target_title = (comment.content[:40] if comment and comment.content else target_title)
        elif row.target_type in {"listing", "game"}:
            listing = db.get(models.Listing, row.target_id)
            target_owner_id = listing.seller_id if listing else None
            target_title = listing.title if listing else target_title
        elif row.target_type == "service":
            task = db.get(models.ServiceTask, row.target_id)
            target_owner_id = task.requester_id if task else None
            target_title = task.title if task else target_title
        elif row.target_type == "wanted":
            wanted = db.get(models.WantedPost, row.target_id)
            target_owner_id = wanted.user_id if wanted else None
            target_title = wanted.title if wanted else target_title
        elif row.target_type == "community":
            post = db.get(models.CommunityPost, row.target_id)
            target_owner_id = post.author_id if post else None
            target_title = (post.title or post.content[:40]) if post else target_title
        target_user = db.get(models.User, target_owner_id) if target_owner_id else None
        items.append({
            "id": row.id,
            "reason": row.reason,
            "description": row.description,
            "status": row.status,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "target_title": target_title,
            "admin_note": row.admin_note,
            "action_taken": row.action_taken,
            "created_at": row.created_at,
            "handled_at": row.handled_at,
            "reporter": user_payload(row.reporter) if row.reporter else None,
            "target_user": user_payload(target_user) if target_user else None,
        })
    return {"items": items}


@router.post("/reports/{report_id}/handle")
def admin_handle_report(
    report_id: int,
    data: ReportHandle,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    report = db.get(models.Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="举报不存在")
    target_user_id = None
    if report.target_type == "user":
        target_user_id = report.target_id
    elif report.target_type == "comment":
        comment = db.get(models.ContentComment, report.target_id)
        target_user_id = comment.user_id if comment else None
    elif report.target_type in {"listing", "game"}:
        listing = db.get(models.Listing, report.target_id)
        target_user_id = listing.seller_id if listing else None
    elif report.target_type == "service":
        task = db.get(models.ServiceTask, report.target_id)
        target_user_id = task.requester_id if task else None
    elif report.target_type == "wanted":
        wanted = db.get(models.WantedPost, report.target_id)
        target_user_id = wanted.user_id if wanted else None
    elif report.target_type == "community":
        post = db.get(models.CommunityPost, report.target_id)
        target_user_id = post.author_id if post else None

    target = db.get(models.User, target_user_id) if target_user_id else None
    action = data.action
    if target and action != "none":
        if action == "warn":
            create_notification(
                db,
                recipient_id=target.id,
                actor_id=admin.id,
                notification_type="official",
                title="【官方提醒】平台合规提醒",
                content=data.admin_note or f"因举报「{report.reason}」，请注意文明交易与发帖规范。",
                target_type="report",
                target_id=report.id,
            )
        if action in {"ban_comment", "ban_both"}:
            target.can_comment = False
        if action in {"ban_post", "ban_both"}:
            target.can_post = False
        if action == "disable_user":
            target.is_active = False
        if action in {"ban_comment", "ban_post", "ban_both", "disable_user"}:
            target.ban_reason = data.admin_note or report.reason
            create_notification(
                db,
                recipient_id=target.id,
                actor_id=admin.id,
                notification_type="official",
                title="【官方处罚】账号权限已调整",
                content=data.admin_note or f"因举报「{report.reason}」，平台已限制你的部分功能。",
                target_type="user",
                target_id=target.id,
            )
        if action == "trust_penalty" or data.trust_delta:
            delta = data.trust_delta if data.trust_delta is not None else -35
            db.add(models.TrustScoreEvent(
                user_id=target.id,
                event_type=f"report_verified_{report.id}",
                points_delta=delta,
                reason=data.admin_note or report.reason,
                related_type="report",
                related_id=report.id,
                occurred_on=None,
            ))
            create_notification(
                db,
                recipient_id=target.id,
                actor_id=admin.id,
                notification_type="official",
                title="【官方通知】信任分已调整",
                content=f"因举报核实，信任分变动 {delta} 分。{data.admin_note or ''}".strip(),
                target_type="user",
                target_id=target.id,
            )

    report.status = data.status
    report.admin_note = data.admin_note
    report.action_taken = action
    report.handled_by = admin.id
    report.handled_at = datetime.utcnow()
    create_notification(
        db,
        recipient_id=report.reporter_id,
        actor_id=admin.id,
        notification_type="official",
        title="【官方反馈】你的举报已处理",
        content=data.admin_note or f"举报「{report.reason}」已处理，状态：{data.status}",
        target_type="report",
        target_id=report.id,
    )
    db.commit()
    return {"message": "举报已处理", "id": report.id, "status": report.status}


@router.get("/users")
def admin_list_users(
    keyword: str = Query(default=""),
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    query = db.query(models.User).outerjoin(models.UserProfile).options(joinedload(models.User.profile))
    if keyword.strip():
        key = keyword.strip()
        query = query.filter(or_(
            models.User.username.contains(key),
            models.User.email.contains(key),
            models.UserProfile.nickname.contains(key),
        ))
    rows = query.order_by(models.User.id.desc()).limit(limit).all()
    return {
        "items": [{
            **user_payload(user),
            "is_admin": bool(getattr(user, "is_admin", False)),
            "is_active": bool(user.is_active),
            "can_comment": bool(getattr(user, "can_comment", True)),
            "can_post": bool(getattr(user, "can_post", True)),
            "ban_reason": getattr(user, "ban_reason", None),
            "trust": compute_trust(db, user.id),
            "email": user.email,
        } for user in rows]
    }


@router.put("/users/{user_id}/penalties")
def admin_update_user_penalties(
    user_id: int,
    data: UserPenaltyUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    target = db.get(models.User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="不能处罚当前管理员账号")
    if data.can_comment is not None:
        target.can_comment = data.can_comment
    if data.can_post is not None:
        target.can_post = data.can_post
    if data.is_active is not None:
        target.is_active = data.is_active
    if data.ban_reason is not None:
        target.ban_reason = data.ban_reason
    if data.trust_delta:
        db.add(models.TrustScoreEvent(
            user_id=target.id,
            event_type=f"admin_adjust_{admin.id}_{int(datetime.utcnow().timestamp())}",
            points_delta=data.trust_delta,
            reason=data.trust_note or "管理员调整信任分",
            related_type="admin",
            related_id=admin.id,
            occurred_on=None,
        ))
    create_notification(
        db,
        recipient_id=target.id,
        actor_id=admin.id,
        notification_type="official",
        title="【官方通知】账号状态更新",
        content=data.ban_reason or data.trust_note or "管理员已更新你的账号权限或信任分。",
        target_type="user",
        target_id=target.id,
    )
    db.commit()
    return {
        "message": "用户状态已更新",
        "user": {
            **user_payload(target),
            "can_comment": target.can_comment,
            "can_post": target.can_post,
            "is_active": target.is_active,
            "trust": compute_trust(db, target.id),
        },
    }


@router.post("/notices", status_code=201)
def admin_send_official_notice(
    data: OfficialNoticeCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    recipients = []
    if data.broadcast:
        recipients = [row.id for row in db.query(models.User.id).filter(
            models.User.is_active.is_(True),
            models.User.id != admin.id,
        ).all()]
    elif data.recipient_user_id:
        target = db.get(models.User, data.recipient_user_id)
        if not target:
            raise HTTPException(status_code=404, detail="接收用户不存在")
        recipients = [target.id]
    else:
        raise HTTPException(status_code=400, detail="请选择接收用户或开启全站广播")

    for recipient_id in recipients:
        create_notification(
            db,
            recipient_id=recipient_id,
            actor_id=admin.id,
            notification_type="official",
            title=f"【官方通知】{data.title}",
            content=data.content,
            target_type="official",
            target_id=admin.id,
        )
    db.commit()
    return {"message": f"已发送官方通知（{len(recipients)} 人）", "count": len(recipients)}
