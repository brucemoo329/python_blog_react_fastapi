from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app import models
from app.db import SessionLocal


router = APIRouter(prefix="/marketplace", tags=["campus-marketplace"])
MAX_CAMPUS_AMOUNT = Decimal("999999.99")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer campus-token-"):
        raise HTTPException(status_code=401, detail="登录状态已失效，请重新登录")
    try:
        user_id = int(authorization.rsplit("-", 1)[1])
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="无效的登录凭证")
    user = db.get(models.User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="用户不存在或已停用")
    return user


class ListingCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=2, max_length=3000)
    price: Decimal = Field(gt=0)
    original_price: Optional[Decimal] = Field(default=None, gt=0)
    category_id: Optional[int] = None
    condition: str = "good"
    trade_type: Literal["physical", "digital"] = "physical"
    campus: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    image_urls: list[str] = Field(default_factory=list)


class ServiceTaskCreate(BaseModel):
    task_type: Literal["express", "takeout", "errand", "purchase"]
    title: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    reward: Decimal = Field(gt=0)
    pickup_location: Optional[str] = None
    delivery_location: str = Field(min_length=2, max_length=120)
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    deadline: Optional[datetime] = None
    image_url: Optional[str] = None


class CommunityPostCreate(BaseModel):
    content: str = Field(min_length=2, max_length=3000)
    title: Optional[str] = Field(default=None, max_length=120)
    topic: str = Field(default="校园生活", max_length=50)
    image_url: Optional[str] = None
    source_type: Optional[str] = Field(default=None, max_length=30)
    source_id: Optional[int] = None
    source_title: Optional[str] = Field(default=None, max_length=160)


class WantedPostCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=2, max_length=2000)
    budget_min: Optional[Decimal] = Field(default=None, ge=0)
    budget_max: Optional[Decimal] = Field(default=None, ge=0)
    location_name: Optional[str] = None
    image_url: Optional[str] = None


class FavoriteCreate(BaseModel):
    listing_id: int


class ProfileUpdate(BaseModel):
    nickname: Optional[str] = Field(default=None, max_length=80)
    avatar_url: Optional[str] = None
    background_url: Optional[str] = None
    background_theme: Optional[str] = Field(default=None, max_length=40)
    school: Optional[str] = Field(default=None, max_length=120)
    signature: Optional[str] = Field(default=None, max_length=180)
    language: Optional[str] = Field(default=None, max_length=20)


class AccountSecurityUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=50)
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(default=None, min_length=6, max_length=255)


class AddressCreate(BaseModel):
    label: str = Field(default="宿舍", max_length=40)
    receiver_name: str = Field(min_length=1, max_length=80)
    phone: Optional[str] = Field(default=None, max_length=40)
    school: Optional[str] = Field(default=None, max_length=120)
    detail: str = Field(min_length=2, max_length=240)
    is_default: bool = False


class PaymentMethodCreate(BaseModel):
    method_type: Literal["payment", "payout"]
    channel: str = Field(max_length=40)
    display_name: str = Field(min_length=1, max_length=120)
    account_mask: Optional[str] = Field(default=None, max_length=80)
    is_default: bool = False


class HistoryCreate(BaseModel):
    item_type: str = Field(max_length=30)
    item_id: int
    title: str = Field(min_length=1, max_length=160)
    image_url: Optional[str] = None
    price_label: Optional[str] = Field(default=None, max_length=60)


class CommentCreate(BaseModel):
    target_type: str = Field(max_length=30)
    target_id: int
    content: str = Field(min_length=1, max_length=1200)
    parent_id: Optional[int] = None


class ReactionCreate(BaseModel):
    target_type: str = Field(max_length=30)
    target_id: int
    reaction_type: Literal["like", "dislike"]


class ShareCreate(BaseModel):
    source_type: str = Field(max_length=30)
    source_id: int
    comment: Optional[str] = Field(default=None, max_length=300)


def user_payload(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_url": profile.avatar_url if profile else None,
        "nickname": (profile.nickname if profile and profile.nickname else user.username),
        "school": profile.school if profile else None,
    }


def listing_payload(listing):
    return {
        "id": listing.id,
        "type": "game" if listing.trade_type == "digital" else "listing",
        "title": listing.title,
        "description": listing.description,
        "price": float(listing.price),
        "original_price": float(listing.original_price) if listing.original_price else None,
        "condition": listing.condition,
        "trade_type": listing.trade_type,
        "status": listing.status,
        "location": listing.location_name,
        "image_url": listing.images[0].image_url if listing.images else None,
        "seller": user_payload(listing.seller),
        "school": listing.campus,
        "created_at": listing.created_at,
    }


def ensure_user_profile(db: Session, user: models.User, request: Optional[Request] = None):
    profile = db.query(models.UserProfile).filter_by(user_id=user.id).first()
    if not profile:
        profile = models.UserProfile(
            user_id=user.id,
            nickname=user.username,
            school="南通理工学院",
            signature="在校园里认真交易，也认真生活。",
            background_theme="teal",
        )
        db.add(profile)
        db.flush()
    if request:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        real_ip = request.headers.get("x-real-ip")
        ip_value = forwarded_for.split(",")[0].strip() or real_ip or (request.client.host if request.client else "")
        if ip_value.startswith(("10.", "172.", "192.168.", "127.")) or ip_value in {"", "::1"}:
            profile.current_ip = "江苏省 南通市"
        else:
            profile.current_ip = "公网网络 · 位置待确认"
    return profile


def trust_grade(score: int):
    if score >= 880:
        return "S 级可信同学"
    if score >= 760:
        return "优秀"
    if score >= 620:
        return "良好"
    if score >= 480:
        return "观察中"
    return "需谨慎"


def compute_trust(db: Session, user_id: int):
    completed_orders = db.query(models.Order).filter(
        or_(models.Order.buyer_id == user_id, models.Order.seller_id == user_id),
        models.Order.status.in_(["completed", "success", "delivered"]),
    ).count()
    positive_reviews = db.query(models.Review).filter(
        models.Review.reviewed_user_id == user_id,
        models.Review.rating >= 4,
    ).count()
    verified_reports = db.query(models.Report).filter(
        models.Report.target_type == "user",
        models.Report.target_id == user_id,
        models.Report.status.in_(["accepted", "confirmed", "valid", "resolved"]),
    ).count()
    pending_reports = db.query(models.Report).filter(
        models.Report.target_type == "user",
        models.Report.target_id == user_id,
        models.Report.status == "pending",
    ).count()

    event_points = db.query(func.coalesce(func.sum(models.TrustScoreEvent.points_delta), 0)).filter(
        models.TrustScoreEvent.user_id == user_id,
        ~models.TrustScoreEvent.event_type.in_(["daily_login", "profile_visit"]),
    ).scalar() or 0
    score = 800 + int(event_points) + completed_orders * 12 + positive_reviews * 15 - verified_reports * 35
    score = max(0, min(1000, score))
    return {
        "score": score,
        "grade": trust_grade(score),
        "base_score": 800,
        "completed_orders": completed_orders,
        "positive_reviews": positive_reviews,
        "verified_reports": verified_reports,
        "pending_reports": pending_reports,
        "rules": [
            {"label": "每日签到", "points": "+2", "note": "需要手动点击签到，每天一次"},
            {"label": "交易成功", "points": "+12", "note": "买卖双方完成后加分"},
            {"label": "获得好评", "points": "+15", "note": "4 星及以上评价加分"},
            {"label": "核实违规", "points": "-35", "note": "只有投诉被核实才扣分，待处理投诉不扣分"},
        ],
    }


def compact_listing_payload(listing):
    return {
        "id": listing.id,
        "type": "listing",
        "title": listing.title,
        "status": listing.status,
        "price_label": f"¥{float(listing.price):.0f}",
        "image_url": listing.images[0].image_url if getattr(listing, "images", None) else None,
        "created_at": listing.created_at,
    }


def compact_order_payload(order, role: str):
    title = order.listing.title if order.listing else (order.service_task.title if order.service_task else "校园交易订单")
    return {
        "id": order.id,
        "order_no": order.order_no,
        "title": title,
        "role": role,
        "amount": float(order.amount),
        "status": order.status,
        "created_at": order.created_at,
        "completed_at": order.completed_at,
    }


def default_category_id(db: Session) -> int:
    category = db.query(models.Category).filter_by(slug="campus-general").first()
    if not category:
        category = models.Category(
            name="校园好物",
            slug="campus-general",
            icon="package",
            sort_order=999,
            is_active=True,
        )
        db.add(category)
        db.flush()
    return category.id


def validate_amount(value: Optional[Decimal], label: str):
    if value is not None and value > MAX_CAMPUS_AMOUNT:
        raise HTTPException(status_code=400, detail=f"{label}不能超过 999999.99 元")


def reaction_counts(db: Session, target_type: str, target_id: int, user_id: Optional[int] = None):
    rows = db.query(models.ContentReaction.reaction_type, func.count(models.ContentReaction.id)).filter_by(
        target_type=target_type,
        target_id=target_id,
    ).group_by(models.ContentReaction.reaction_type).all()
    counts = {reaction_type: count for reaction_type, count in rows}
    my_reaction = None
    if user_id:
        row = db.query(models.ContentReaction).filter_by(
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
        ).first()
        my_reaction = row.reaction_type if row else None
    return {
        "likes": int(counts.get("like", 0)),
        "dislikes": int(counts.get("dislike", 0)),
        "my_reaction": my_reaction,
    }


def comment_payload(comment, child_map, db: Session, user_id: int):
    return {
        "id": comment.id,
        "author": user_payload(comment.user),
        "content": comment.content,
        "created_at": comment.created_at,
        "likes": comment.like_count or 0,
        "dislikes": comment.dislike_count or 0,
        "reaction": reaction_counts(db, "comment", comment.id, user_id)["my_reaction"],
        "replies": [comment_payload(child, child_map, db, user_id) for child in child_map.get(comment.id, [])],
    }


def detail_payload(db: Session, item_type: str, item_id: int, user: models.User):
    normalized = "listing" if item_type == "game" else item_type
    if normalized == "listing":
        listing = db.query(models.Listing).options(
            joinedload(models.Listing.seller).joinedload(models.User.profile),
            joinedload(models.Listing.images),
        ).filter_by(id=item_id).first()
        if not listing:
            raise HTTPException(status_code=404, detail="内容不存在")
        result_type = "game" if listing.trade_type == "digital" else "listing"
        return {
            "id": listing.id,
            "type": result_type,
            "title": listing.title,
            "description": listing.description,
            "price": float(listing.price),
            "price_label": f"¥{float(listing.price):.2f}",
            "status": listing.status,
            "location": listing.location_name,
            "school": listing.campus or (listing.seller.profile.school if listing.seller.profile else None),
            "images": [image.image_url for image in listing.images],
            "author": {**user_payload(listing.seller), "trust": compute_trust(db, listing.seller_id)},
            "created_at": listing.created_at,
            "reaction": reaction_counts(db, result_type, listing.id, user.id),
            "can_delete": listing.seller_id == user.id,
        }
    if normalized == "service":
        task = db.query(models.ServiceTask).options(
            joinedload(models.ServiceTask.requester).joinedload(models.User.profile)
        ).filter_by(id=item_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="内容不存在")
        return {
            "id": task.id,
            "type": "service",
            "title": task.title,
            "description": task.description,
            "price": float(task.reward),
            "price_label": f"赏金 ¥{float(task.reward):.2f}",
            "status": task.status,
            "location": task.delivery_location,
            "school": task.requester.profile.school if task.requester.profile else None,
            "images": [task.image_url] if task.image_url else [],
            "author": {**user_payload(task.requester), "trust": compute_trust(db, task.requester_id)},
            "created_at": task.created_at,
            "reaction": reaction_counts(db, "service", task.id, user.id),
            "can_delete": task.requester_id == user.id,
        }
    if normalized == "wanted":
        wanted = db.query(models.WantedPost).options(
            joinedload(models.WantedPost.user).joinedload(models.User.profile)
        ).filter_by(id=item_id).first()
        if not wanted:
            raise HTTPException(status_code=404, detail="内容不存在")
        price = float(wanted.budget_max) if wanted.budget_max is not None else None
        return {
            "id": wanted.id,
            "type": "wanted",
            "title": wanted.title,
            "description": wanted.description,
            "price": price,
            "price_label": f"预算 ¥{price:.2f}" if price is not None else "预算面议",
            "status": wanted.status,
            "location": wanted.location_name,
            "school": wanted.user.profile.school if wanted.user.profile else None,
            "images": [wanted.image_url] if wanted.image_url else [],
            "author": {**user_payload(wanted.user), "trust": compute_trust(db, wanted.user_id)},
            "created_at": wanted.created_at,
            "reaction": reaction_counts(db, "wanted", wanted.id, user.id),
            "can_delete": wanted.user_id == user.id,
        }
    if normalized == "community":
        post = db.query(models.CommunityPost).options(
            joinedload(models.CommunityPost.author).joinedload(models.User.profile)
        ).filter_by(id=item_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="内容不存在")
        return {
            "id": post.id,
            "type": "community",
            "title": post.title or "校园动态",
            "description": post.content,
            "price": None,
            "price_label": f"{post.like_count or 0} 人喜欢",
            "status": post.topic,
            "location": "校园社区",
            "school": post.author.profile.school if post.author.profile else None,
            "images": [post.image_url] if post.image_url else [],
            "author": {**user_payload(post.author), "trust": compute_trust(db, post.author_id)},
            "created_at": post.created_at,
            "source": {
                "type": post.source_type,
                "id": post.source_id,
                "title": post.source_title,
            } if post.source_type and post.source_id else None,
            "reaction": reaction_counts(db, "community", post.id, user.id),
            "can_delete": post.author_id == user.id,
        }
    raise HTTPException(status_code=404, detail="内容类型不存在")


@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).filter(models.Category.is_active.is_(True)).order_by(
        models.Category.sort_order, models.Category.id
    ).all()


@router.get("/feed")
def get_feed(
    kind: str = Query(default="all"),
    search: str = Query(default="", max_length=80),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    items = []
    if kind in {"all", "listing", "game"}:
        query = db.query(models.Listing).options(
            joinedload(models.Listing.seller), joinedload(models.Listing.images)
        )
        if kind == "game":
            query = query.filter(models.Listing.trade_type == "digital")
        if search:
            query = query.filter(or_(
                models.Listing.title.contains(search),
                models.Listing.description.contains(search),
            ))
        items.extend(listing_payload(row) for row in query.order_by(models.Listing.created_at.desc()).limit(30))

    if kind in {"all", "service"}:
        for task in db.query(models.ServiceTask).options(joinedload(models.ServiceTask.requester)).order_by(
            models.ServiceTask.created_at.desc()
        ).limit(20):
            items.append({
                "id": task.id,
                "type": "service",
                "task_type": task.task_type,
                "title": task.title,
                "description": task.description,
                "reward": float(task.reward),
                "status": task.status,
                "pickup_location": task.pickup_location,
                "location": task.delivery_location,
                "latitude": float(task.latitude) if task.latitude is not None else None,
                "longitude": float(task.longitude) if task.longitude is not None else None,
                "author": user_payload(task.requester),
                "created_at": task.created_at,
            })

    if kind in {"all", "wanted"}:
        for wanted in db.query(models.WantedPost).options(joinedload(models.WantedPost.user)).order_by(
            models.WantedPost.created_at.desc()
        ).limit(20):
            items.append({
                "id": wanted.id,
                "type": "wanted",
                "title": wanted.title,
                "description": wanted.description,
                "budget_min": float(wanted.budget_min) if wanted.budget_min else None,
                "budget_max": float(wanted.budget_max) if wanted.budget_max else None,
                "location": wanted.location_name,
                "status": wanted.status,
                "author": user_payload(wanted.user),
                "created_at": wanted.created_at,
            })

    if kind in {"all", "community"}:
        for post in db.query(models.CommunityPost).options(joinedload(models.CommunityPost.author)).order_by(
            models.CommunityPost.created_at.desc()
        ).limit(20):
            items.append({
                "id": post.id,
                "type": "community",
                "title": post.title,
                "description": post.content,
                "topic": post.topic,
                "image_url": post.image_url,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "source": {
                    "type": post.source_type,
                    "id": post.source_id,
                    "title": post.source_title,
                } if post.source_type and post.source_id else None,
                "author": user_payload(post.author),
                "created_at": post.created_at,
            })

    items.sort(key=lambda item: item["created_at"] or datetime.min, reverse=True)
    return {"items": items[:50], "total": len(items)}


@router.get("/map/tasks")
def get_map_tasks(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    tasks = db.query(models.ServiceTask).options(joinedload(models.ServiceTask.requester)).filter(
        models.ServiceTask.status == "open"
    ).order_by(models.ServiceTask.created_at.desc()).limit(30).all()
    return [{
        "id": task.id,
        "task_type": task.task_type,
        "title": task.title,
        "reward": float(task.reward),
        "pickup_location": task.pickup_location,
        "delivery_location": task.delivery_location,
        "latitude": float(task.latitude) if task.latitude is not None else None,
        "longitude": float(task.longitude) if task.longitude is not None else None,
        "requester": user_payload(task.requester),
        "deadline": task.deadline,
    } for task in tasks]


@router.post("/listings", status_code=201)
def create_listing(
    data: ListingCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    validate_amount(data.price, "价格")
    validate_amount(data.original_price, "原价")
    listing = models.Listing(
        seller_id=user.id,
        category_id=data.category_id or default_category_id(db),
        title=data.title,
        description=data.description,
        price=data.price,
        original_price=data.original_price,
        condition=data.condition,
        trade_type=data.trade_type,
        campus=data.campus,
        location_name=data.location_name,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(listing)
    db.flush()
    for index, url in enumerate(data.image_urls[:8]):
        db.add(models.ListingImage(listing_id=listing.id, image_url=url, sort_order=index))
    db.commit()
    db.refresh(listing)
    return {"message": "商品发布成功", "id": listing.id, "type": "game" if listing.trade_type == "digital" else "listing"}


@router.post("/tasks", status_code=201)
def create_task(
    data: ServiceTaskCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    validate_amount(data.reward, "跑腿赏金")
    task = models.ServiceTask(requester_id=user.id, **data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "任务发布成功", "id": task.id, "type": "service"}


@router.post("/tasks/{task_id}/accept")
def accept_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.get(models.ServiceTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.requester_id == user.id:
        raise HTTPException(status_code=400, detail="不能接取自己发布的任务")
    if task.status != "open":
        raise HTTPException(status_code=409, detail="任务已被接取")
    task.runner_id = user.id
    task.status = "accepted"
    db.commit()
    return {"message": "接单成功"}


@router.post("/community", status_code=201)
def create_community_post(
    data: CommunityPostCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    post = models.CommunityPost(author_id=user.id, **data.model_dump())
    db.add(post)
    db.commit()
    return {"message": "动态发布成功", "id": post.id, "type": "community"}


@router.post("/wanted", status_code=201)
def create_wanted_post(
    data: WantedPostCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    validate_amount(data.budget_min, "最低预算")
    validate_amount(data.budget_max, "最高预算")
    post = models.WantedPost(user_id=user.id, **data.model_dump())
    db.add(post)
    db.commit()
    return {"message": "求购发布成功", "id": post.id, "type": "wanted"}


@router.post("/favorites")
def toggle_favorite(
    data: FavoriteCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    listing = db.get(models.Listing, data.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="商品不存在")
    favorite = db.query(models.Favorite).filter_by(
        user_id=user.id, listing_id=data.listing_id
    ).first()
    if favorite:
        db.delete(favorite)
        db.commit()
        return {"message": "已取消收藏", "favorited": False}
    db.add(models.Favorite(user_id=user.id, listing_id=data.listing_id))
    db.commit()
    return {"message": "收藏成功", "favorited": True}


@router.post("/orders/listing/{listing_id}", status_code=201)
def create_listing_order(
    listing_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    listing = db.get(models.Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="商品不存在")
    if listing.seller_id == user.id:
        raise HTTPException(status_code=400, detail="不能购买自己发布的商品")
    if listing.status != "available":
        raise HTTPException(status_code=409, detail="商品当前不可购买")
    order = models.Order(
        order_no=f"CM{datetime.now():%Y%m%d}{uuid4().hex[:10].upper()}",
        buyer_id=user.id,
        seller_id=listing.seller_id,
        listing_id=listing.id,
        amount=listing.price,
    )
    listing.status = "pending"
    db.add(order)
    db.commit()
    return {"message": "订单已创建，请与卖家确认线下交易", "order_no": order.order_no}


@router.get("/detail/{item_type}/{item_id}")
def get_detail(
    item_type: str,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = detail_payload(db, item_type, item_id, user)
    comments = db.query(models.ContentComment).options(
        joinedload(models.ContentComment.user).joinedload(models.User.profile)
    ).filter_by(
        target_type=item["type"],
        target_id=item["id"],
    ).order_by(models.ContentComment.created_at.asc()).all()
    child_map = {}
    roots = []
    for comment in comments:
        if comment.parent_id:
            child_map.setdefault(comment.parent_id, []).append(comment)
        else:
            roots.append(comment)
    return {
        "item": item,
        "comments": [comment_payload(comment, child_map, db, user.id) for comment in roots],
    }


@router.delete("/content/{item_type}/{item_id}")
def delete_content(
    item_type: str,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    normalized = "listing" if item_type == "game" else item_type
    cleanup_target_types = {item_type}

    if normalized == "listing":
        item = db.get(models.Listing, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="内容不存在")
        if item.seller_id != user.id:
            raise HTTPException(status_code=403, detail="只能删除自己发布的内容")
        cleanup_target_types.update({"listing", "game"})
    elif normalized == "service":
        item = db.get(models.ServiceTask, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="内容不存在")
        if item.requester_id != user.id:
            raise HTTPException(status_code=403, detail="只能删除自己发布的内容")
        cleanup_target_types.add("service")
    elif normalized == "wanted":
        item = db.get(models.WantedPost, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="内容不存在")
        if item.user_id != user.id:
            raise HTTPException(status_code=403, detail="只能删除自己发布的内容")
        cleanup_target_types.add("wanted")
    elif normalized == "community":
        item = db.get(models.CommunityPost, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="内容不存在")
        if item.author_id != user.id:
            raise HTTPException(status_code=403, detail="只能删除自己发布的内容")
        cleanup_target_types.add("community")
    else:
        raise HTTPException(status_code=404, detail="内容类型不存在")

    for target_type in cleanup_target_types:
        db.query(models.ContentReaction).filter_by(target_type=target_type, target_id=item_id).delete()
        db.query(models.ContentComment).filter_by(target_type=target_type, target_id=item_id).delete()
        db.query(models.BrowseHistory).filter_by(item_type=target_type, item_id=item_id).delete()

    db.delete(item)
    db.commit()
    return {"message": "已删除发布内容"}


@router.post("/comments", status_code=201)
def create_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    detail_payload(db, data.target_type, data.target_id, user)
    if data.parent_id and not db.get(models.ContentComment, data.parent_id):
        raise HTTPException(status_code=404, detail="回复的评论不存在")
    comment = models.ContentComment(
        target_type=data.target_type,
        target_id=data.target_id,
        parent_id=data.parent_id,
        user_id=user.id,
        content=data.content,
    )
    db.add(comment)
    if data.target_type == "community":
        post = db.get(models.CommunityPost, data.target_id)
        if post:
            post.comment_count = (post.comment_count or 0) + 1
    db.commit()
    return {"message": "留言成功", "id": comment.id}


@router.post("/reactions")
def toggle_reaction(
    data: ReactionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if data.target_type != "comment":
        detail_payload(db, data.target_type, data.target_id, user)
    elif not db.get(models.ContentComment, data.target_id):
        raise HTTPException(status_code=404, detail="评论不存在")

    existing = db.query(models.ContentReaction).filter_by(
        user_id=user.id,
        target_type=data.target_type,
        target_id=data.target_id,
    ).first()
    if existing and existing.reaction_type == data.reaction_type:
        db.delete(existing)
    elif existing:
        existing.reaction_type = data.reaction_type
    else:
        db.add(models.ContentReaction(
            user_id=user.id,
            target_type=data.target_type,
            target_id=data.target_id,
            reaction_type=data.reaction_type,
        ))
    db.commit()

    if data.target_type == "comment":
        comment = db.get(models.ContentComment, data.target_id)
        comment.like_count = db.query(models.ContentReaction).filter_by(target_type="comment", target_id=data.target_id, reaction_type="like").count()
        comment.dislike_count = db.query(models.ContentReaction).filter_by(target_type="comment", target_id=data.target_id, reaction_type="dislike").count()
        db.commit()
    elif data.target_type == "community":
        post = db.get(models.CommunityPost, data.target_id)
        if post:
            post.like_count = db.query(models.ContentReaction).filter_by(target_type="community", target_id=data.target_id, reaction_type="like").count()
            db.commit()
    return {"message": "已更新态度", **reaction_counts(db, data.target_type, data.target_id, user.id)}


@router.post("/shares", status_code=201)
def share_content(
    data: ShareCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    source = detail_payload(db, data.source_type, data.source_id, user)
    title = f"我转发的{source['title']}"
    content = data.comment.strip() if data.comment else f"转发一个校园内容：{source['title']}"
    post = models.CommunityPost(
        author_id=user.id,
        title=title,
        content=content,
        topic="校园转发",
        image_url=source["images"][0] if source.get("images") else None,
        source_type=source["type"],
        source_id=source["id"],
        source_title=source["title"],
    )
    db.add(post)
    db.commit()
    return {"message": "已转发到校园社区", "id": post.id, "type": "community"}


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = ensure_user_profile(db, user)
    trust = compute_trust(db, user.id)
    return {
        "active_listings": db.query(models.Listing).filter(models.Listing.status == "available").count(),
        "open_tasks": db.query(models.ServiceTask).filter(models.ServiceTask.status == "open").count(),
        "community_posts": db.query(models.CommunityPost).count(),
        "my_orders": db.query(models.Order).filter(
            or_(models.Order.buyer_id == user.id, models.Order.seller_id == user.id)
        ).count(),
        "unread_messages": db.query(models.Message).filter(
            models.Message.sender_id != user.id,
            models.Message.is_read.is_(False),
        ).count(),
        "profile": {
            "nickname": profile.nickname or user.username,
            "avatar_url": profile.avatar_url,
            "school": profile.school or "南通理工学院",
            "language": profile.language or "zh-CN",
            "background_url": profile.background_url,
            "background_theme": profile.background_theme or "teal",
        },
        "trust": {
            "score": trust["score"],
            "grade": trust["grade"],
        },
    }


@router.get("/profile")
def get_profile(
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = ensure_user_profile(db, user, request)
    today = date.today()
    checked_in_today = db.query(models.TrustScoreEvent).filter_by(
        user_id=user.id,
        event_type="daily_check_in",
        occurred_on=today,
    ).first() is not None
    db.commit()
    db.refresh(profile)

    favorite_rows = db.query(models.Favorite).filter_by(user_id=user.id).order_by(
        models.Favorite.created_at.desc()
    ).limit(20).all()
    favorite_ids = [row.listing_id for row in favorite_rows]
    favorites = []
    if favorite_ids:
        listings = db.query(models.Listing).options(joinedload(models.Listing.images)).filter(
            models.Listing.id.in_(favorite_ids)
        ).all()
        listing_map = {listing.id: listing for listing in listings}
        favorites = [compact_listing_payload(listing_map[item_id]) for item_id in favorite_ids if item_id in listing_map]

    published = {
        "listings": [
            compact_listing_payload(item)
            for item in db.query(models.Listing).options(joinedload(models.Listing.images)).filter_by(
                seller_id=user.id
            ).order_by(models.Listing.created_at.desc()).limit(12)
        ],
        "services": [
            {"id": item.id, "type": "service", "title": item.title, "status": item.status, "price_label": f"¥{float(item.reward):.0f}", "created_at": item.created_at}
            for item in db.query(models.ServiceTask).filter_by(requester_id=user.id).order_by(models.ServiceTask.created_at.desc()).limit(12)
        ],
        "wanted": [
            {"id": item.id, "type": "wanted", "title": item.title, "status": item.status, "price_label": f"预算 ¥{float(item.budget_max):.0f}" if item.budget_max else "预算面议", "created_at": item.created_at}
            for item in db.query(models.WantedPost).filter_by(user_id=user.id).order_by(models.WantedPost.created_at.desc()).limit(12)
        ],
        "posts": [
            {"id": item.id, "type": "community", "title": item.title or item.content[:24], "status": item.topic, "price_label": f"{item.like_count} 赞", "created_at": item.created_at}
            for item in db.query(models.CommunityPost).filter_by(author_id=user.id).order_by(models.CommunityPost.created_at.desc()).limit(12)
        ],
    }

    bought_orders = db.query(models.Order).options(
        joinedload(models.Order.listing), joinedload(models.Order.service_task)
    ).filter_by(buyer_id=user.id).order_by(models.Order.created_at.desc()).limit(12).all()
    sold_orders = db.query(models.Order).options(
        joinedload(models.Order.listing), joinedload(models.Order.service_task)
    ).filter_by(seller_id=user.id).order_by(models.Order.created_at.desc()).limit(12).all()

    pending_reviews = []
    for order in bought_orders + sold_orders:
        if order.status not in {"completed", "success", "delivered"}:
            continue
        reviewed = db.query(models.Review).filter_by(order_id=order.id, reviewer_id=user.id).first()
        if not reviewed:
            pending_reviews.append(compact_order_payload(order, "buyer" if order.buyer_id == user.id else "seller"))

    recent_events = db.query(models.TrustScoreEvent).filter_by(user_id=user.id).order_by(
        models.TrustScoreEvent.created_at.desc()
    ).limit(8).all()

    return {
        "user": user_payload(user),
        "profile": {
            "nickname": profile.nickname or user.username,
            "avatar_url": profile.avatar_url,
            "background_url": profile.background_url,
            "background_theme": profile.background_theme or "teal",
            "school": profile.school or "南通理工学院",
            "signature": profile.signature or "",
            "current_ip": profile.current_ip,
            "language": profile.language or "zh-CN",
            "followers": profile.follower_count or 0,
            "following": profile.following_count or 0,
        },
        "trust": {
            **compute_trust(db, user.id),
            "checked_in_today": checked_in_today,
            "events": [
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "points_delta": event.points_delta,
                    "reason": event.reason,
                    "created_at": event.created_at,
                }
                for event in recent_events
            ],
        },
        "addresses": db.query(models.UserAddress).filter_by(user_id=user.id).order_by(
            models.UserAddress.is_default.desc(), models.UserAddress.updated_at.desc()
        ).all(),
        "payment_methods": db.query(models.UserPaymentMethod).filter_by(user_id=user.id).order_by(
            models.UserPaymentMethod.is_default.desc(), models.UserPaymentMethod.created_at.desc()
        ).all(),
        "favorites": favorites,
        "history": db.query(models.BrowseHistory).filter_by(user_id=user.id).order_by(
            models.BrowseHistory.viewed_at.desc()
        ).limit(20).all(),
        "published": published,
        "sold": [compact_order_payload(item, "seller") for item in sold_orders],
        "bought": [compact_order_payload(item, "buyer") for item in bought_orders],
        "pending_reviews": pending_reviews[:12],
    }


@router.put("/profile")
def update_profile(
    data: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = ensure_user_profile(db, user, request)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return {"message": "个人资料已保存", "profile": {
        "nickname": profile.nickname or user.username,
        "avatar_url": profile.avatar_url,
        "background_url": profile.background_url,
        "background_theme": profile.background_theme,
        "school": profile.school,
        "signature": profile.signature,
        "current_ip": profile.current_ip,
        "language": profile.language,
    }}


@router.post("/profile/check-in")
def check_in(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    today = date.today()
    exists = db.query(models.TrustScoreEvent).filter_by(
        user_id=user.id,
        event_type="daily_check_in",
        occurred_on=today,
    ).first()
    if exists:
        return {"message": "今天已经签到过了", "checked_in_today": True, "trust": compute_trust(db, user.id)}
    db.add(models.TrustScoreEvent(
        user_id=user.id,
        event_type="daily_check_in",
        points_delta=2,
        reason="每日签到加分",
        occurred_on=today,
    ))
    db.commit()
    return {"message": "签到成功，信任分 +2", "checked_in_today": True, "trust": compute_trust(db, user.id)}


@router.put("/profile/security")
def update_account_security(
    data: AccountSecurityUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    changed = False
    if data.username and data.username != user.username:
        old_username = user.username
        exists = db.query(models.User).filter(models.User.username == data.username, models.User.id != user.id).first()
        if exists:
            raise HTTPException(status_code=409, detail="用户名已存在")
        user.username = data.username
        profile = ensure_user_profile(db, user)
        if not profile.nickname or profile.nickname == old_username:
            profile.nickname = data.username
        changed = True

    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="请输入当前密码")
        if user.hashed_password != data.current_password:
            raise HTTPException(status_code=401, detail="当前密码错误")
        user.hashed_password = data.new_password
        changed = True

    if not changed:
        raise HTTPException(status_code=400, detail="没有需要保存的账号安全修改")
    db.commit()
    return {"message": "账号安全设置已更新", "user": user_payload(user)}


@router.post("/profile/addresses", status_code=201)
def create_address(
    data: AddressCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if data.is_default:
        db.query(models.UserAddress).filter_by(user_id=user.id).update({"is_default": False})
    address = models.UserAddress(user_id=user.id, **data.model_dump())
    db.add(address)
    db.commit()
    return {"message": "地址已添加", "id": address.id}


@router.post("/profile/payment-methods", status_code=201)
def create_payment_method(
    data: PaymentMethodCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if data.is_default:
        db.query(models.UserPaymentMethod).filter_by(
            user_id=user.id,
            method_type=data.method_type,
        ).update({"is_default": False})
    method = models.UserPaymentMethod(user_id=user.id, **data.model_dump())
    db.add(method)
    db.commit()
    return {"message": "方式已保存", "id": method.id}


@router.post("/profile/history")
def record_history(
    data: HistoryCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    history = db.query(models.BrowseHistory).filter_by(
        user_id=user.id,
        item_type=data.item_type,
        item_id=data.item_id,
    ).first()
    if history:
        history.title = data.title
        history.image_url = data.image_url
        history.price_label = data.price_label
        history.viewed_at = func.now()
    else:
        db.add(models.BrowseHistory(user_id=user.id, **data.model_dump()))
    db.commit()
    return {"message": "浏览历史已记录"}
