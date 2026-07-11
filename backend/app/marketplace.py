import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app import models
from app.db import SessionLocal


router = APIRouter(prefix="/marketplace", tags=["campus-marketplace"])
MAX_CAMPUS_AMOUNT = Decimal("999999.99")

# Campus centers (lng, lat) — keep in sync with frontend/src/lib/schools.js
SCHOOL_COORDS = {
    "北京大学": (116.3109, 39.9928),
    "北京大学燕园": (116.3109, 39.9928),
    "北京大学医学部": (116.356, 39.986),
    "清华大学": (116.3269, 40.003),
    "清华大学本部": (116.3269, 40.003),
    "清华大学深圳国际研究生院": (113.979, 22.597),
    "复旦大学": (121.5037, 31.2989),
    "复旦大学邯郸校区": (121.5037, 31.2989),
    "复旦大学江湾校区": (121.5045, 31.337),
    "上海交通大学": (121.4365, 31.0252),
    "上海交通大学闵行校区": (121.4365, 31.0252),
    "上海交通大学徐汇校区": (121.4368, 31.2005),
    "浙江大学": (120.0869, 30.3086),
    "浙江大学紫金港校区": (120.0869, 30.3086),
    "浙江大学玉泉校区": (120.1233, 30.2635),
    "南京大学": (118.7802, 32.0563),
    "南京大学鼓楼校区": (118.7802, 32.0563),
    "南京大学仙林校区": (118.958, 32.119),
    "武汉大学": (114.3655, 30.538),
    "中山大学": (113.298, 23.096),
    "中山大学南校区": (113.298, 23.096),
    "中山大学东校区": (113.392, 23.065),
    "南通理工学院": (120.809261, 32.041042),
    "南通理工学院南通校区": (120.809261, 32.041042),
    "南通理工学院海安校区": (120.4675, 32.5458),
}


def school_center_lng_lat(school_name: Optional[str] = None):
    """Return (lng, lat) for a school name; default Nantong only when unknown/empty."""
    name = (school_name or "").strip()
    if not name or name == "未选择学校":
        return 120.809261, 32.041042
    if name in SCHOOL_COORDS:
        return SCHOOL_COORDS[name]
    for key, coords in SCHOOL_COORDS.items():
        if key in name or name in key:
            return coords
    return 120.809261, 32.041042


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
    profile = db.query(models.UserProfile).filter_by(user_id=user.id).first()
    if not profile:
        profile = models.UserProfile(
            user_id=user.id,
            nickname=user.username,
            school="未选择学校",
            signature="在校园里认真交易，也认真生活。",
            background_theme="teal",
        )
        db.add(profile)
    profile.last_active_at = datetime.utcnow()
    db.commit()
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
    pickup_location: Optional[str] = Field(default=None, max_length=200)
    delivery_location: str = Field(min_length=2, max_length=200)
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    pickup_latitude: Optional[Decimal] = None
    pickup_longitude: Optional[Decimal] = None
    delivery_latitude: Optional[Decimal] = None
    delivery_longitude: Optional[Decimal] = None
    desired_delivery_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    image_url: Optional[str] = None


class TaskAcceptBody(BaseModel):
    runner_latitude: Optional[Decimal] = None
    runner_longitude: Optional[Decimal] = None
    travel_mode: Optional[Literal["walk", "ride", "drive", "auto"]] = "auto"
    eta_seconds: Optional[int] = None
    distance_meters: Optional[int] = None


class TaskLocationBody(BaseModel):
    latitude: Decimal
    longitude: Decimal
    eta_seconds: Optional[int] = None
    distance_meters: Optional[int] = None
    travel_mode: Optional[Literal["walk", "ride", "drive", "auto"]] = None


class TaskDesiredTimeBody(BaseModel):
    desired_delivery_at: datetime


class TaskTravelModeBody(BaseModel):
    travel_mode: Literal["walk", "ride", "drive", "auto"] = "ride"
    eta_seconds: Optional[int] = None
    distance_meters: Optional[int] = None


class OrderCancelBody(BaseModel):
    reason: str = Field(default="双方协商取消", min_length=2, max_length=240)


class OrderReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    content: Optional[str] = Field(default=None, max_length=500)
    is_complaint: bool = False


class OrderAppealBody(BaseModel):
    reason: str = Field(min_length=4, max_length=500)
    review_id: Optional[int] = None


class AfterSaleApplyBody(BaseModel):
    reason: str = Field(default="", max_length=500)

    model_config = {"extra": "ignore"}


class AfterSaleResponseBody(BaseModel):
    agree: bool = False
    response: Optional[str] = Field(default=None, max_length=500)

    model_config = {"extra": "ignore"}


class SupportTicketBody(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    content: str = Field(min_length=4, max_length=2000)
    category: str = Field(default="general", max_length=40)
    order_id: Optional[int] = None


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
    target_type: Optional[str] = Field(default=None, max_length=30)
    target_id: Optional[int] = None
    listing_id: Optional[int] = None


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


class ReportCreate(BaseModel):
    target_type: str = Field(max_length=30)
    target_id: int
    reason: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)


class ConversationStart(BaseModel):
    target_user_id: int
    context_type: Optional[str] = Field(default=None, max_length=30)
    context_id: Optional[int] = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000000)
    message_type: Literal["text", "image", "location", "transfer", "product", "order"] = "text"
    metadata: Optional[dict[str, Any]] = None
    reply_to_id: Optional[int] = None


class OrderShipBody(BaseModel):
    meeting_location: Optional[str] = Field(default=None, max_length=120)
    seller_note: Optional[str] = Field(default=None, max_length=240)


class OrderPayBody(BaseModel):
    buyer_note: Optional[str] = Field(default=None, max_length=240)
    delivery_method: Optional[str] = Field(default="campus_meet", max_length=30)
    meeting_location: Optional[str] = Field(default=None, max_length=120)


class MessageReactionCreate(BaseModel):
    emoji: str = Field(min_length=1, max_length=20)


def normalize_target_type(target_type: str):
    return "listing" if target_type == "game" else target_type


def profile_is_online(profile):
    if not profile or not profile.last_active_at:
        return False
    last_active = profile.last_active_at
    if last_active.tzinfo:
        last_active = last_active.replace(tzinfo=None)
    return datetime.utcnow() - last_active <= timedelta(minutes=5)


def user_payload(user):
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar_url": profile.avatar_url if profile else None,
        "nickname": (profile.nickname if profile and profile.nickname else user.username),
        "school": profile.school if profile else None,
        "signature": profile.signature if profile else None,
        "is_online": profile_is_online(profile),
        "last_active_at": profile.last_active_at if profile else None,
        "is_admin": bool(getattr(user, "is_admin", False)),
        "can_comment": bool(getattr(user, "can_comment", True)),
        "can_post": bool(getattr(user, "can_post", True)),
    }


def assert_can_post(user: models.User):
    if not getattr(user, "can_post", True):
        raise HTTPException(status_code=403, detail=getattr(user, "ban_reason", None) or "你的发帖权限已被限制，请联系管理员")


def assert_can_comment(user: models.User):
    if not getattr(user, "can_comment", True):
        raise HTTPException(status_code=403, detail=getattr(user, "ban_reason", None) or "你的评论权限已被限制，请联系管理员")


ORDER_STATUS_LABELS = {
    "pending_payment": {"buyer": "等待我付款", "seller": "等待对方付款"},
    "pending_ship": {"buyer": "等待卖家发货", "seller": "等待我方发货"},
    "shipped": {"buyer": "卖家已发货", "seller": "已发货，待收货"},
    "completed": {"buyer": "已收货完成", "seller": "交易完成"},
    "cancelled": {"buyer": "已取消", "seller": "已取消"},
    "pending_confirm": {"buyer": "待确认", "seller": "待确认"},
    "refunded": {"buyer": "退款完成", "seller": "退款完成"},
}


def order_status_label(status: str, role: str) -> str:
    labels = ORDER_STATUS_LABELS.get(status) or {"buyer": status, "seller": status}
    return labels.get(role, status)


def content_owner_id(db: Session, target_type: str, target_id: int):
    normalized = normalize_target_type(target_type)
    if normalized == "listing":
        item = db.get(models.Listing, target_id)
        return item.seller_id if item else None
    if normalized == "service":
        item = db.get(models.ServiceTask, target_id)
        return item.requester_id if item else None
    if normalized == "wanted":
        item = db.get(models.WantedPost, target_id)
        return item.user_id if item else None
    if normalized == "community":
        item = db.get(models.CommunityPost, target_id)
        return item.author_id if item else None
    if normalized == "user":
        return target_id if db.get(models.User, target_id) else None
    return None


def is_following(db: Session, follower_id: int, following_id: int):
    return db.query(models.UserFollow).filter_by(
        follower_id=follower_id,
        following_id=following_id,
    ).first() is not None


def is_favorited(db: Session, user_id: int, target_type: str, target_id: int):
    exists = db.query(models.ContentFavorite).filter_by(
        user_id=user_id,
        target_type=target_type,
        target_id=target_id,
    ).first()
    if exists:
        return True
    if normalize_target_type(target_type) == "listing":
        return db.query(models.Favorite).filter_by(
            user_id=user_id,
            listing_id=target_id,
        ).first() is not None
    return False


def content_metrics(db: Session, user_id: int, target_type: str, target_id: int):
    reaction = reaction_counts(db, target_type, target_id, user_id)
    return {
        "reaction": reaction,
        "like_count": reaction["likes"],
        "dislike_count": reaction["dislikes"],
        "comment_count": db.query(models.ContentComment).filter_by(
            target_type=target_type,
            target_id=target_id,
        ).count(),
        "repost_count": db.query(models.CommunityPost).filter_by(
            source_type=target_type,
            source_id=target_id,
        ).count(),
        "favorited": is_favorited(db, user_id, target_type, target_id),
    }


def create_notification(
    db: Session,
    recipient_id: int,
    notification_type: str,
    title: str,
    content: Optional[str] = None,
    actor_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
):
    notification = models.Notification(
        recipient_id=recipient_id,
        actor_id=actor_id,
        notification_type=notification_type,
        title=title,
        content=content,
        target_type=target_type,
        target_id=target_id,
    )
    db.add(notification)
    return notification


PHASE_LABELS = {
    "pending": "待接单",
    "to_pickup": "跑手前往取货",
    "picked_up": "已取货",
    "delivering": "配送中",
    "delivered": "已送达",
}

MODE_LABELS = {
    "walk": "步行",
    "ride": "骑行",
    "drive": "驾车",
    "auto": "智能",
}


def _num(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def suggest_travel_mode(distance_meters: Optional[float]) -> str:
    if distance_meters is None:
        return "ride"
    if distance_meters < 1200:
        return "walk"
    if distance_meters < 6000:
        return "ride"
    return "drive"


def haversine_meters(lat1, lon1, lat2, lon2) -> Optional[float]:
    try:
        from math import asin, cos, radians, sin, sqrt
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    r = 6371000.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


PICKUP_CONFIRM_RADIUS_M = 280
DELIVERY_CONFIRM_RADIUS_M = 280


def _as_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if getattr(value, "tzinfo", None):
        return value.replace(tzinfo=None)
    return value


def can_late_complain(task: models.ServiceTask, current_user_id: Optional[int]) -> bool:
    if not current_user_id or current_user_id != task.requester_id:
        return False
    if task.late_complaint_at or not task.runner_id:
        return False
    if task.status not in {"accepted"} and (task.delivery_phase or "") in {"pending", "delivered"}:
        return False
    if task.status == "open" or task.status == "completed" or task.status == "cancelled":
        return False
    desired = _as_naive_utc(task.desired_delivery_at or task.deadline)
    if not desired:
        return False
    return datetime.utcnow() >= desired + timedelta(minutes=20)


def service_task_tracking_payload(
    task: models.ServiceTask,
    current_user_id: Optional[int] = None,
    order_id: Optional[int] = None,
    db: Optional[Session] = None,
):
    desired = task.desired_delivery_at or task.deadline
    pickup_lat = _num(task.pickup_latitude) if task.pickup_latitude is not None else _num(task.latitude)
    pickup_lng = _num(task.pickup_longitude) if task.pickup_longitude is not None else _num(task.longitude)
    delivery_lat = _num(task.delivery_latitude)
    delivery_lng = _num(task.delivery_longitude)
    # Address-only tasks: campus-center fallbacks by requester school (not always Nantong)
    school_name = None
    if getattr(task, "requester", None) and getattr(task.requester, "profile", None):
        school_name = task.requester.profile.school
    base_lng, base_lat = school_center_lng_lat(school_name)
    if pickup_lat is None or pickup_lng is None:
        offset = ((task.id or 0) % 17 - 8) * 0.00028
        pickup_lng = pickup_lng if pickup_lng is not None else base_lng + offset
        pickup_lat = pickup_lat if pickup_lat is not None else base_lat + offset * 0.7
    if delivery_lat is None or delivery_lng is None:
        offset = ((task.id or 0) % 13 - 6) * 0.00032
        delivery_lng = delivery_lng if delivery_lng is not None else base_lng - offset
        delivery_lat = delivery_lat if delivery_lat is not None else base_lat - offset * 0.6

    if order_id is None and db is not None and task and task.id:
        row = db.query(models.Order.id).filter_by(service_task_id=task.id).first()
        order_id = row[0] if row else None

    role = None
    if current_user_id:
        if current_user_id == task.requester_id:
            role = "requester"
        elif current_user_id == task.runner_id:
            role = "runner"

    eta_minutes = int(round(task.eta_seconds / 60)) if task.eta_seconds else None
    phase = task.delivery_phase or ("pending" if task.status == "open" else "to_pickup")
    progress_text = PHASE_LABELS.get(phase, phase)
    if eta_minutes is not None and phase in {"to_pickup", "delivering"}:
        if phase == "to_pickup":
            progress_text = f"跑手前往取货 · 预计 {eta_minutes} 分钟"
        else:
            progress_text = f"配送中 · 预计 {eta_minutes} 分钟送达"

    runner_lat = _num(task.runner_latitude)
    runner_lng = _num(task.runner_longitude)
    dist_to_pickup = haversine_meters(runner_lat, runner_lng, pickup_lat, pickup_lng) if runner_lat is not None and pickup_lat is not None else None
    dist_to_delivery = haversine_meters(runner_lat, runner_lng, delivery_lat, delivery_lng) if runner_lat is not None and delivery_lat is not None else None
    can_confirm_pickup = (
        role == "runner"
        and phase == "to_pickup"
        and dist_to_pickup is not None
        and dist_to_pickup <= PICKUP_CONFIRM_RADIUS_M
    )
    can_confirm_delivery = (
        role == "runner"
        and phase in {"delivering", "picked_up"}
        and dist_to_delivery is not None
        and dist_to_delivery <= DELIVERY_CONFIRM_RADIUS_M
    )

    return {
        "id": task.id,
        "type": "service",
        "task_type": task.task_type,
        "title": task.title,
        "description": task.description,
        "reward": float(task.reward),
        "status": task.status,
        "delivery_phase": phase,
        "phase_label": PHASE_LABELS.get(phase, phase),
        "progress_text": progress_text,
        "pickup_location": task.pickup_location,
        "delivery_location": task.delivery_location,
        "pickup": {"lat": pickup_lat, "lng": pickup_lng, "label": task.pickup_location or "取货点"},
        "delivery": {"lat": delivery_lat, "lng": delivery_lng, "label": task.delivery_location or "送达点"},
        "runner": {
            "lat": runner_lat,
            "lng": runner_lng,
            "updated_at": task.runner_location_updated_at,
            "user": user_payload(task.runner) if task.runner else None,
        },
        "requester": user_payload(task.requester) if task.requester else None,
        "travel_mode": task.travel_mode or "auto",
        "travel_mode_label": MODE_LABELS.get(task.travel_mode or "auto", "智能"),
        "eta_seconds": task.eta_seconds,
        "eta_minutes": eta_minutes,
        "distance_meters": task.distance_meters,
        "distance_to_pickup_m": int(dist_to_pickup) if dist_to_pickup is not None else None,
        "distance_to_delivery_m": int(dist_to_delivery) if dist_to_delivery is not None else None,
        "pickup_radius_m": PICKUP_CONFIRM_RADIUS_M,
        "delivery_radius_m": DELIVERY_CONFIRM_RADIUS_M,
        "can_confirm_pickup": can_confirm_pickup,
        "can_confirm_delivery": can_confirm_delivery,
        "desired_delivery_at": desired,
        "accepted_at": task.accepted_at,
        "picked_up_at": task.picked_up_at,
        "completed_at": task.completed_at,
        "late_complaint_at": task.late_complaint_at,
        "can_complain_late": can_late_complain(task, current_user_id),
        "role": role,
        "image_url": task.image_url,
        "created_at": task.created_at,
        "latitude": pickup_lat or delivery_lat,
        "longitude": pickup_lng or delivery_lng,
        "order_id": order_id,
    }


def serialize_service_detail(db: Session, task: models.ServiceTask, user: models.User):
    tracking = service_task_tracking_payload(task, user.id, db=db)
    return {
        "id": task.id,
        "type": "service",
        "task_type": task.task_type,
        "title": task.title,
        "description": task.description,
        "price": float(task.reward),
        "price_label": f"赏金 ¥{float(task.reward):.2f}",
        "status": task.status,
        "location": task.delivery_location,
        "pickup_location": task.pickup_location,
        "delivery_location": task.delivery_location,
        "school": task.requester.profile.school if task.requester and task.requester.profile else None,
        "images": [task.image_url] if task.image_url else [],
        "author": {**user_payload(task.requester), "trust": compute_trust(db, task.requester_id)} if task.requester else None,
        "runner": user_payload(task.runner) if task.runner else None,
        "created_at": task.created_at,
        "reaction": reaction_counts(db, "service", task.id, user.id),
        "can_delete": task.requester_id == user.id,
        "can_accept": task.status == "open" and task.requester_id != user.id,
        "tracking": tracking,
        "desired_delivery_at": task.desired_delivery_at or task.deadline,
        "latitude": tracking.get("latitude"),
        "longitude": tracking.get("longitude"),
    }


def get_conversation_for_user(db: Session, conversation_id: int, user_id: int):
    conversation = db.get(models.Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")
    if user_id not in {conversation.user_a_id, conversation.user_b_id}:
        raise HTTPException(status_code=403, detail="无权访问该会话")
    return conversation


def find_or_create_conversation(
    db: Session,
    user_id: int,
    target_user_id: int,
    context_type: Optional[str] = None,
    context_id: Optional[int] = None,
):
    if user_id == target_user_id:
        raise HTTPException(status_code=400, detail="不能和自己创建私信")
    target_user = db.get(models.User, target_user_id)
    if not target_user or not target_user.is_active:
        raise HTTPException(status_code=404, detail="对方用户不存在")
    blocked = db.query(models.UserModeration).filter(
        models.UserModeration.action == "block",
        or_(
            (models.UserModeration.user_id == user_id) & (models.UserModeration.target_user_id == target_user_id),
            (models.UserModeration.user_id == target_user_id) & (models.UserModeration.target_user_id == user_id),
        ),
    ).first()
    if blocked:
        raise HTTPException(status_code=403, detail="当前无法与该用户发起私信")
    user_a_id, user_b_id = sorted((user_id, target_user_id))
    conversation = db.query(models.Conversation).filter_by(
        user_a_id=user_a_id,
        user_b_id=user_b_id,
    ).first()
    if not conversation:
        conversation = models.Conversation(
            user_a_id=user_a_id,
            user_b_id=user_b_id,
            context_type=context_type,
            context_id=context_id,
            listing_id=context_id if context_type in {"listing", "game"} else None,
        )
        db.add(conversation)
        db.flush()
    elif context_type and context_id:
        conversation.context_type = context_type
        conversation.context_id = context_id
        if context_type in {"listing", "game"}:
            conversation.listing_id = context_id
    return conversation


def message_payload(db: Session, message: models.Message, current_user_id: int):
    metadata = None
    if message.metadata_json:
        try:
            metadata = json.loads(message.metadata_json)
        except (TypeError, ValueError):
            metadata = None
    reaction_rows = db.query(models.MessageReaction.emoji, func.count(models.MessageReaction.id)).filter_by(
        message_id=message.id,
    ).group_by(models.MessageReaction.emoji).all()
    my_reactions = {
        row.emoji for row in db.query(models.MessageReaction).filter_by(
            message_id=message.id,
            user_id=current_user_id,
        ).all()
    }
    reply = None
    if message.reply_to:
        reply = {
            "id": message.reply_to.id,
            "content": message.reply_to.content[:160],
            "sender": user_payload(message.reply_to.sender),
        }
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender": user_payload(message.sender),
        "content": message.content,
        "message_type": message.message_type or "text",
        "metadata": metadata,
        "reply_to": reply,
        "reactions": [
            {"emoji": emoji, "count": int(count), "reacted": emoji in my_reactions}
            for emoji, count in reaction_rows
        ],
        "is_read": message.is_read,
        "created_at": message.created_at,
        "is_mine": message.sender_id == current_user_id,
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
        "view_count": listing.view_count or 0,
        "created_at": listing.created_at,
    }


def ensure_user_profile(db: Session, user: models.User, request: Optional[Request] = None):
    profile = db.query(models.UserProfile).filter_by(user_id=user.id).first()
    if not profile:
        profile = models.UserProfile(
            user_id=user.id,
            nickname=user.username,
            school="未选择学校",
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
    total_reviews = db.query(models.Review).filter(
        models.Review.reviewed_user_id == user_id,
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
    positive_rate = round((positive_reviews / total_reviews) * 100, 1) if total_reviews else 100.0
    return {
        "score": score,
        "grade": trust_grade(score),
        "base_score": 800,
        "completed_orders": completed_orders,
        "positive_reviews": positive_reviews,
        "total_reviews": total_reviews,
        "positive_rate": positive_rate,
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
        "type": "game" if listing.trade_type == "digital" else "listing",
        "title": listing.title,
        "status": listing.status,
        "price_label": f"¥{float(listing.price):.0f}",
        "image_url": listing.images[0].image_url if getattr(listing, "images", None) else None,
        "created_at": listing.created_at,
    }


def compact_content_payload(item):
    return {
        "id": item["id"],
        "type": item["type"],
        "item_type": item["type"],
        "item_id": item["id"],
        "title": item["title"],
        "status": item.get("status"),
        "price_label": item.get("price_label"),
        "image_url": item.get("images", [None])[0] if item.get("images") else None,
        "created_at": item.get("created_at"),
    }


def compact_order_payload(order, role: str):
    is_service = bool(order.service_task_id)
    title = order.listing.title if order.listing else (order.service_task.title if order.service_task else "校园交易订单")
    image_url = None
    if order.listing and getattr(order.listing, "images", None):
        image_url = order.listing.images[0].image_url if order.listing.images else None
    elif order.service_task:
        image_url = order.service_task.image_url
    status_label = order_status_label(order.status, role)
    if is_service and order.service_task:
        phase = order.service_task.delivery_phase or "pending"
        if order.status == "cancelled":
            status_label = "已取消"
        elif order.status == "completed":
            status_label = "已完成"
        elif phase == "to_pickup":
            status_label = "跑手取货中" if role == "buyer" else "前往取货"
        elif phase in {"delivering", "picked_up"}:
            status_label = "配送中"
        else:
            status_label = "进行中"
    return {
        "id": order.id,
        "order_no": order.order_no,
        "title": title,
        "role": role,
        "kind": "service" if is_service else "listing",
        "amount": float(order.amount),
        "status": order.status,
        "status_label": status_label,
        "image_url": image_url,
        "listing_id": order.listing_id,
        "service_task_id": order.service_task_id,
        "delivery_method": order.delivery_method,
        "meeting_location": order.meeting_location or (
            f"{order.service_task.pickup_location or ''} → {order.service_task.delivery_location or ''}"
            if order.service_task else None
        ),
        "created_at": order.created_at,
        "paid_at": getattr(order, "paid_at", None),
        "shipped_at": getattr(order, "shipped_at", None),
        "received_at": getattr(order, "received_at", None),
        "completed_at": order.completed_at,
        "cancelled_by_id": getattr(order, "cancelled_by_id", None),
    }


def peer_role_label(is_service: bool, peer_is_buyer: bool) -> str:
    """评价对象角色文案：跑腿区分发布者/跑手，商品区分买家/卖家。"""
    if is_service:
        return "发布者" if peer_is_buyer else "跑手"
    return "买家" if peer_is_buyer else "卖家"


def full_order_payload(db: Session, order: models.Order, user_id: int):
    role = "buyer" if order.buyer_id == user_id else "seller"
    is_service = bool(order.service_task_id)
    payload = compact_order_payload(order, role)
    my_review = db.query(models.Review).filter_by(order_id=order.id, reviewer_id=user_id).first()
    can_review = order.status in {"completed", "cancelled"} and my_review is None
    # 被对方取消后，可选择投诉（差评）或不投诉（跳过）
    peer_cancelled = (
        order.status == "cancelled"
        and getattr(order, "cancelled_by_id", None)
        and order.cancelled_by_id != user_id
        and my_review is None
    )
    peer_user = order.seller if role == "buyer" else order.buyer
    peer_role = peer_role_label(is_service, peer_is_buyer=(role != "buyer"))
    my_role_label = peer_role_label(is_service, peer_is_buyer=(role == "buyer"))
    received = db.query(models.Review).filter_by(order_id=order.id, reviewed_user_id=user_id).all()
    received_payload = [{
        "id": r.id,
        "rating": r.rating,
        "content": r.content,
        "is_complaint": bool(getattr(r, "is_complaint", False) or (r.rating or 0) <= 2),
        "created_at": r.created_at,
    } for r in received]
    complaints_against_me = [r for r in received_payload if r["is_complaint"]]
    appeals = db.query(models.OrderAppeal).filter_by(order_id=order.id, appellant_id=user_id).order_by(
        models.OrderAppeal.created_at.desc()
    ).all()
    appeal_payload = [{
        "id": a.id,
        "review_id": a.review_id,
        "reason": a.reason,
        "status": a.status,
        "admin_note": a.admin_note,
        "created_at": a.created_at,
        "handled_at": a.handled_at,
    } for a in appeals]
    has_pending_appeal = any(a.status == "pending" for a in appeals)
    approved_review_ids = {a.review_id for a in appeals if a.status == "approved" and a.review_id}
    open_complaints = [c for c in complaints_against_me if c["id"] not in approved_review_ids]
    can_appeal = bool(open_complaints) and not has_pending_appeal

    deleted_for_me = bool(
        (role == "buyer" and getattr(order, "buyer_deleted", False))
        or (role == "seller" and getattr(order, "seller_deleted", False))
    )
    # 已完成 / 已取消 / 退款完成 后均可软删除自己的记录
    can_delete_record = order.status in {"completed", "cancelled", "refunded"} and not deleted_for_me
    after_sale = None
    try:
        after_sale = db.query(models.AfterSaleRequest).filter_by(order_id=order.id).order_by(
            models.AfterSaleRequest.created_at.desc()
        ).first()
    except Exception:
        db.rollback()
        after_sale = None
    after_sale_active = after_sale and after_sale.status in {"pending_seller", "admin_pending"}
    can_apply_after_sale = (
        role == "buyer"
        and not is_service
        and order.status in {"pending_ship", "shipped", "completed"}
        and not after_sale_active
    )
    can_respond_after_sale = bool(
        role == "seller" and after_sale and after_sale.status == "pending_seller"
    )

    def _dt(value):
        if value is None:
            return None
        try:
            return value.isoformat() if hasattr(value, "isoformat") else str(value)
        except Exception:
            return None

    payload.update({
        "buyer": user_payload(order.buyer) if order.buyer else None,
        "seller": user_payload(order.seller) if order.seller else None,
        "buyer_note": getattr(order, "buyer_note", None),
        "seller_note": getattr(order, "seller_note", None),
        "cancel_reason": getattr(order, "cancel_reason", None),
        "description": order.listing.description if order.listing else (order.service_task.description if order.service_task else None),
        "actions": order_actions_for_role(order.status, role, is_service=is_service),
        "can_review": can_review,
        "peer_cancelled": peer_cancelled,
        "my_role_label": my_role_label,
        "review_target": {
            "user": user_payload(peer_user) if peer_user else None,
            "role_label": peer_role,
            "hint": f"你正在评价对方（{peer_role}）" + (
                f"：{(peer_user.profile.nickname if peer_user and peer_user.profile and peer_user.profile.nickname else None) or (peer_user.username if peer_user else '')}"
            ),
        },
        "my_review": {
            "id": my_review.id,
            "rating": my_review.rating,
            "content": my_review.content,
            "is_complaint": bool(getattr(my_review, "is_complaint", False) or (my_review.rating or 0) <= 2),
        } if my_review else None,
        "received_reviews": received_payload,
        "complaints_against_me": complaints_against_me,
        "can_appeal": can_appeal,
        "my_appeals": appeal_payload,
        "can_delete_record": can_delete_record,
        "can_apply_after_sale": can_apply_after_sale,
        "can_respond_after_sale": can_respond_after_sale,
        "after_sale": {
            "id": after_sale.id,
            "reason": after_sale.reason or "",
            "status": after_sale.status or "pending_seller",
            "seller_response": after_sale.seller_response,
            "admin_note": after_sale.admin_note,
            "created_at": _dt(after_sale.created_at),
            "responded_at": _dt(after_sale.responded_at),
            "handled_at": _dt(after_sale.handled_at),
        } if after_sale else None,
        "service_task": service_task_tracking_payload(order.service_task, user_id, db=db, order_id=order.id) if order.service_task else None,
    })
    return payload


def order_actions_for_role(status: str, role: str, is_service: bool = False):
    if status in {"completed", "cancelled"}:
        return ["review"] if True else []
    if is_service:
        # 跑腿订单：双方均可取消；进行中可打开导航
        actions = ["cancel", "navigate"]
        return actions
    if status == "pending_payment":
        return ["pay", "cancel"] if role == "buyer" else ["cancel"]
    if status == "pending_ship":
        return ["remind"] if role == "buyer" else ["ship", "cancel"]
    if status == "shipped":
        return ["receive"] if role == "buyer" else ["track"]
    return []


def make_order_no(prefix: str = "CP") -> str:
    return f"{prefix}{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid4().hex[:6].upper()}"


def get_or_create_service_order(db: Session, task: models.ServiceTask) -> models.Order:
    """跑腿接单后生成双边可见订单：buyer=发布者，seller=跑手。"""
    existing = db.query(models.Order).filter_by(service_task_id=task.id).first()
    if existing:
        return existing
    order = models.Order(
        order_no=make_order_no("RN"),
        buyer_id=task.requester_id,
        seller_id=task.runner_id,
        service_task_id=task.id,
        amount=task.reward,
        status="pending_ship",
        delivery_method="errand",
        meeting_location=f"{task.pickup_location or '取货点'} → {task.delivery_location or '送达点'}",
        paid_at=datetime.utcnow(),
        buyer_note="跑腿订单（赏金）",
    )
    db.add(order)
    db.flush()
    return order


def sync_service_order_status(db: Session, task: models.ServiceTask):
    order = db.query(models.Order).filter_by(service_task_id=task.id).first()
    if not order:
        return None
    if task.status == "cancelled":
        order.status = "cancelled"
    elif task.status == "completed" or task.delivery_phase == "delivered":
        order.status = "completed"
        order.completed_at = order.completed_at or datetime.utcnow()
        order.received_at = order.received_at or datetime.utcnow()
    elif task.delivery_phase in {"delivering", "picked_up"}:
        order.status = "shipped"
        order.shipped_at = order.shipped_at or datetime.utcnow()
    elif task.status == "accepted":
        order.status = "pending_ship"
    return order


def send_order_system_message(db: Session, order: models.Order, sender_id: int, content: str, metadata: dict):
    conversation = find_or_create_conversation(
        db,
        order.buyer_id,
        order.seller_id,
        context_type="listing" if order.listing_id else "order",
        context_id=order.listing_id or order.id,
    )
    message = models.Message(
        conversation_id=conversation.id,
        sender_id=sender_id,
        content=content,
        message_type="order",
        metadata_json=json.dumps(metadata, ensure_ascii=False),
    )
    conversation.updated_at = func.now()
    db.add(message)
    return conversation, message


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
        "can_delete": comment.user_id == user_id,
        "replies": [comment_payload(child, child_map, db, user_id) for child in child_map.get(comment.id, [])],
    }


def detail_payload(db: Session, item_type: str, item_id: int, user: models.User):
    normalized = "listing" if item_type == "game" else item_type
    if normalized == "listing":
        listing = db.query(models.Listing).options(
            joinedload(models.Listing.seller).joinedload(models.User.profile),
            joinedload(models.Listing.images),
        ).filter_by(id=item_id).first()
        if not listing or listing.status == "deleted":
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
            joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
            joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
        ).filter_by(id=item_id).first()
        if not task or task.status == "deleted":
            raise HTTPException(status_code=404, detail="内容不存在")
        return serialize_service_detail(db, task, user)
    if normalized == "wanted":
        wanted = db.query(models.WantedPost).options(
            joinedload(models.WantedPost.user).joinedload(models.User.profile)
        ).filter_by(id=item_id).first()
        if not wanted or wanted.status == "deleted":
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
            "price_label": None,
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
    topic: str = Query(default="", max_length=50),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    items = []
    profile = ensure_user_profile(db, user)
    my_school = (profile.school or "").strip()
    # Soft campus preference only — never hard-hide other schools (or your own posts)
    same_school_ids = None
    if my_school and my_school != "未选择学校":
        same_school_ids = {
            row[0] for row in db.query(models.UserProfile.user_id).filter(
                models.UserProfile.school == my_school,
            ).all()
        }
        same_school_ids.add(user.id)
    hidden_user_ids = {
        row.target_user_id for row in db.query(models.UserModeration).filter(
            models.UserModeration.user_id == user.id,
            models.UserModeration.action.in_(["mute", "block"]),
        ).all()
    }

    def _school_rank(owner_id, campus_label=None):
        if same_school_ids is None:
            return 0
        if owner_id == user.id:
            return 0
        if owner_id in same_school_ids:
            return 0
        if campus_label and campus_label == my_school:
            return 0
        return 1  # other schools still visible, sorted later

    if kind in {"all", "listing", "game"}:
        query = db.query(models.Listing).options(
            joinedload(models.Listing.seller).joinedload(models.User.profile),
            joinedload(models.Listing.images),
        ).filter(models.Listing.status == "available")
        if hidden_user_ids:
            query = query.filter(~models.Listing.seller_id.in_(hidden_user_ids))
        if kind == "game":
            query = query.filter(models.Listing.trade_type == "digital")
        elif kind == "listing":
            query = query.filter(models.Listing.trade_type != "digital")
        if search:
            query = query.filter(or_(
                models.Listing.title.contains(search),
                models.Listing.description.contains(search),
            ))
        rows = query.order_by(models.Listing.created_at.desc()).limit(60).all()
        rows.sort(key=lambda row: (
            _school_rank(row.seller_id, row.campus),
            -(row.created_at.timestamp() if row.created_at else 0),
        ))
        items.extend(listing_payload(row) for row in rows[:30])

    if kind in {"all", "service"}:
        query = db.query(models.ServiceTask).options(
            joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
            joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
        )
        if hidden_user_ids:
            query = query.filter(~models.ServiceTask.requester_id.in_(hidden_user_ids))
        if search:
            query = query.filter(or_(models.ServiceTask.title.contains(search), models.ServiceTask.description.contains(search)))
        # 信息流只展示待接单；进行中的任务走导航/右侧进度，避免接单后仍像「可接」
        query = query.filter(models.ServiceTask.status == "open")
        task_rows = query.order_by(models.ServiceTask.created_at.desc()).limit(40).all()
        task_rows.sort(key=lambda task: (
            _school_rank(task.requester_id),
            -(task.created_at.timestamp() if task.created_at else 0),
        ))
        for task in task_rows[:20]:
            items.append({
                "id": task.id,
                "type": "service",
                "task_type": task.task_type,
                "title": task.title,
                "description": task.description,
                "reward": float(task.reward),
                "price_label": f"赏金 ¥{float(task.reward):.2f}",
                "status": task.status,
                "delivery_phase": task.delivery_phase or "pending",
                "pickup_location": task.pickup_location,
                "delivery_location": task.delivery_location,
                "location": task.delivery_location,
                "desired_delivery_at": task.desired_delivery_at or task.deadline,
                "image_url": task.image_url,
                "latitude": float(task.latitude) if task.latitude is not None else None,
                "longitude": float(task.longitude) if task.longitude is not None else None,
                "pickup_latitude": float(task.pickup_latitude) if task.pickup_latitude is not None else None,
                "pickup_longitude": float(task.pickup_longitude) if task.pickup_longitude is not None else None,
                "delivery_latitude": float(task.delivery_latitude) if task.delivery_latitude is not None else None,
                "delivery_longitude": float(task.delivery_longitude) if task.delivery_longitude is not None else None,
                "author": user_payload(task.requester),
                "requester": user_payload(task.requester),
                "school": task.requester.profile.school if task.requester.profile else None,
                "created_at": task.created_at,
            })

    if kind in {"all", "wanted"}:
        query = db.query(models.WantedPost).options(
            joinedload(models.WantedPost.user).joinedload(models.User.profile)
        )
        if hidden_user_ids:
            query = query.filter(~models.WantedPost.user_id.in_(hidden_user_ids))
        if search:
            query = query.filter(or_(models.WantedPost.title.contains(search), models.WantedPost.description.contains(search)))
        wanted_rows = query.order_by(models.WantedPost.created_at.desc()).limit(40).all()
        wanted_rows.sort(key=lambda wanted: (
            _school_rank(wanted.user_id),
            -(wanted.created_at.timestamp() if wanted.created_at else 0),
        ))
        for wanted in wanted_rows[:20]:
            items.append({
                "id": wanted.id,
                "type": "wanted",
                "title": wanted.title,
                "description": wanted.description,
                "budget_min": float(wanted.budget_min) if wanted.budget_min else None,
                "budget_max": float(wanted.budget_max) if wanted.budget_max else None,
                "location": wanted.location_name,
                "status": wanted.status,
                "image_url": wanted.image_url,
                "author": user_payload(wanted.user),
                "school": wanted.user.profile.school if wanted.user.profile else None,
                "created_at": wanted.created_at,
            })

    if kind in {"all", "community"}:
        query = db.query(models.CommunityPost).options(
            joinedload(models.CommunityPost.author).joinedload(models.User.profile)
        )
        if hidden_user_ids:
            query = query.filter(~models.CommunityPost.author_id.in_(hidden_user_ids))
        if search:
            query = query.filter(or_(models.CommunityPost.title.contains(search), models.CommunityPost.content.contains(search)))
        if topic:
            query = query.filter(models.CommunityPost.topic == topic)
        community_rows = query.order_by(models.CommunityPost.created_at.desc()).limit(40).all()
        community_rows.sort(key=lambda post: (
            _school_rank(post.author_id),
            -(post.created_at.timestamp() if post.created_at else 0),
        ))
        for post in community_rows[:20]:
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
                "school": post.author.profile.school if post.author.profile else None,
                "created_at": post.created_at,
            })

    def _owner_id(item):
        owner = item.get("seller") or item.get("author") or item.get("requester") or {}
        return owner.get("id")

    items.sort(key=lambda item: (
        _school_rank(_owner_id(item), item.get("school")),
        -(item["created_at"].timestamp() if item.get("created_at") else 0),
    ))
    result = items[:50]
    for item in result:
        item.update(content_metrics(db, user.id, item["type"], item["id"]))
        item["author_is_followed"] = is_following(
            db,
            user.id,
            (item.get("seller") or item.get("author") or {}).get("id", 0),
        )
    return {"items": result, "total": len(items)}


@router.get("/map/tasks")
def get_map_tasks(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """待接任务点：仅 open 状态，供校园雷达展示与点击跳转。"""
    profile = ensure_user_profile(db, user)
    tasks = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile)
    ).filter(
        models.ServiceTask.status == "open"
    )
    if profile.school and profile.school != "未选择学校":
        tasks = tasks.join(models.User, models.ServiceTask.requester_id == models.User.id).join(
            models.UserProfile, models.UserProfile.user_id == models.User.id
        ).filter(models.UserProfile.school == profile.school)
    tasks = tasks.order_by(models.ServiceTask.created_at.desc()).limit(40).all()
    result = []
    viewer_lng, viewer_lat = school_center_lng_lat(profile.school if profile else None)
    for task in tasks:
        plat = _num(task.pickup_latitude) if task.pickup_latitude is not None else _num(task.latitude)
        plng = _num(task.pickup_longitude) if task.pickup_longitude is not None else _num(task.longitude)
        dlat = _num(task.delivery_latitude)
        dlng = _num(task.delivery_longitude)
        # Prefer real coords; fall back to school center (viewer/requester school), fix lat/lng order
        if plat is None or plng is None:
            req_school = None
            if task.requester and getattr(task.requester, "profile", None):
                req_school = task.requester.profile.school
            base_lng, base_lat = school_center_lng_lat(req_school or (profile.school if profile else None))
            plng = base_lng + ((task.id % 17) - 8) * 0.00035
            plat = base_lat + ((task.id % 13) - 6) * 0.00028
        if dlat is None or dlng is None:
            dlat = dlat if dlat is not None else viewer_lat
            dlng = dlng if dlng is not None else viewer_lng
        result.append({
            "id": task.id,
            "type": "service",
            "task_type": task.task_type,
            "title": task.title,
            "reward": float(task.reward),
            "status": task.status,
            "delivery_phase": task.delivery_phase or "pending",
            "pickup_location": task.pickup_location,
            "delivery_location": task.delivery_location,
            "latitude": plat,
            "longitude": plng,
            "pickup_latitude": plat,
            "pickup_longitude": plng,
            "delivery_latitude": dlat,
            "delivery_longitude": dlng,
            "desired_delivery_at": task.desired_delivery_at or task.deadline,
            "requester": user_payload(task.requester),
            "image_url": task.image_url,
            "deadline": task.deadline,
        })
    return result


@router.post("/listings", status_code=201)
def create_listing(
    data: ListingCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    assert_can_post(user)
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
        campus=data.campus or (ensure_user_profile(db, user).school or "未选择学校"),
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
    assert_can_post(user)
    validate_amount(data.reward, "跑腿赏金")
    payload = data.model_dump()
    # Map pin uses pickup if available, else delivery
    if payload.get("pickup_latitude") is None and payload.get("delivery_latitude") is not None:
        payload["latitude"] = payload.get("delivery_latitude")
        payload["longitude"] = payload.get("delivery_longitude")
    elif payload.get("pickup_latitude") is not None:
        payload["latitude"] = payload.get("pickup_latitude")
        payload["longitude"] = payload.get("pickup_longitude")
    if payload.get("desired_delivery_at") and not payload.get("deadline"):
        payload["deadline"] = payload["desired_delivery_at"]
    task = models.ServiceTask(
        requester_id=user.id,
        delivery_phase="pending",
        travel_mode="auto",
        **payload,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "跑腿任务发布成功", "id": task.id, "type": "service"}


@router.post("/tasks/{task_id}/accept")
def accept_task(
    task_id: int,
    data: TaskAcceptBody = TaskAcceptBody(),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.requester_id == user.id:
        raise HTTPException(status_code=400, detail="不能接取自己发布的任务")
    if task.status != "open":
        raise HTTPException(status_code=409, detail="任务已被接取")
    task.runner_id = user.id
    task.status = "accepted"
    task.delivery_phase = "to_pickup"
    task.accepted_at = datetime.utcnow()
    mode = data.travel_mode or "auto"
    if mode == "auto":
        mode = suggest_travel_mode(data.distance_meters)
    task.travel_mode = mode
    if data.runner_latitude is not None and data.runner_longitude is not None:
        task.runner_latitude = data.runner_latitude
        task.runner_longitude = data.runner_longitude
        task.runner_location_updated_at = datetime.utcnow()
    if data.eta_seconds is not None:
        task.eta_seconds = data.eta_seconds
    if data.distance_meters is not None:
        task.distance_meters = data.distance_meters
    conversation = find_or_create_conversation(
        db,
        user.id,
        task.requester_id,
        context_type="service",
        context_id=task.id,
    )
    create_notification(
        db,
        recipient_id=task.requester_id,
        actor_id=user.id,
        notification_type="task_accepted",
        title="你的跑腿任务已被接单",
        content=f"{user.username} 接下了“{task.title}”，正在前往取货",
        target_type="service",
        target_id=task.id,
    )
    create_notification(
        db,
        recipient_id=user.id,
        notification_type="task_accepted_self",
        title="接单成功",
        content=f"你已接下“{task.title}”，请按导航前往取货点",
        target_type="service",
        target_id=task.id,
    )
    # 生成「我的订单」双边可见的跑腿订单
    order = get_or_create_service_order(db, task)
    db.commit()
    db.refresh(task)
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter_by(id=task_id).first()
    return {
        "message": "接单成功，已进入取货导航，订单已生成",
        "conversation_id": conversation.id,
        "order_id": order.id,
        "tracking": service_task_tracking_payload(task, user.id, db=db),
    }


@router.get("/tasks/active")
def list_active_errands(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tasks = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter(
        models.ServiceTask.status.in_(["accepted", "in_progress"]),
        or_(
            models.ServiceTask.requester_id == user.id,
            models.ServiceTask.runner_id == user.id,
        ),
    ).order_by(models.ServiceTask.accepted_at.desc(), models.ServiceTask.created_at.desc()).limit(20).all()
    return {
        "items": [service_task_tracking_payload(task, user.id, db=db) for task in tasks],
        "total": len(tasks),
    }


@router.get("/tasks/{task_id}/tracking")
def get_task_tracking(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter_by(id=task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    # 兼容旧数据：已接单但未生成订单时补建
    if task.runner_id and task.status in {"accepted", "completed", "cancelled"}:
        get_or_create_service_order(db, task)
        sync_service_order_status(db, task)
        db.commit()
    return {"item": service_task_tracking_payload(task, user.id, db=db)}


@router.post("/tasks/{task_id}/location")
def update_runner_location(
    task_id: int,
    data: TaskLocationBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.runner_id != user.id:
        raise HTTPException(status_code=403, detail="仅接单跑手可更新位置")
    if task.status not in {"accepted", "in_progress"}:
        raise HTTPException(status_code=400, detail="任务未在配送中")
    task.runner_latitude = data.latitude
    task.runner_longitude = data.longitude
    task.runner_location_updated_at = datetime.utcnow()
    if data.eta_seconds is not None:
        task.eta_seconds = data.eta_seconds
    if data.distance_meters is not None:
        task.distance_meters = data.distance_meters
    # Always persist explicit mode so publisher UI stays in sync (walk/ride/drive)
    if data.travel_mode:
        task.travel_mode = data.travel_mode if data.travel_mode != "auto" else (task.travel_mode or "ride")
    db.commit()
    db.refresh(task)
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter_by(id=task_id).first()
    return {"message": "位置已更新", "tracking": service_task_tracking_payload(task, user.id, db=db)}


@router.post("/tasks/{task_id}/travel-mode")
def update_task_travel_mode(
    task_id: int,
    data: TaskTravelModeBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.runner_id != user.id:
        raise HTTPException(status_code=403, detail="仅接单跑手可切换出行方式")
    if task.status not in {"accepted", "in_progress"}:
        raise HTTPException(status_code=400, detail="任务未在配送中")
    mode = data.travel_mode if data.travel_mode != "auto" else suggest_travel_mode(data.distance_meters)
    task.travel_mode = mode
    if data.eta_seconds is not None:
        task.eta_seconds = data.eta_seconds
    if data.distance_meters is not None:
        task.distance_meters = data.distance_meters
    db.commit()
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter_by(id=task_id).first()
    return {"message": f"已切换为{MODE_LABELS.get(mode, mode)}", "tracking": service_task_tracking_payload(task, user.id, db=db)}


@router.post("/tasks/{task_id}/picked-up")
def mark_task_picked_up(
    task_id: int,
    data: Optional[TaskLocationBody] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.runner_id != user.id:
        raise HTTPException(status_code=403, detail="仅接单跑手可确认取货")
    if task.delivery_phase not in {"to_pickup", "picked_up"}:
        raise HTTPException(status_code=400, detail="当前状态无法确认取货")

    runner_lat = data.latitude if data and data.latitude is not None else task.runner_latitude
    runner_lng = data.longitude if data and data.longitude is not None else task.runner_longitude
    pickup_lat = task.pickup_latitude if task.pickup_latitude is not None else task.latitude
    pickup_lng = task.pickup_longitude if task.pickup_longitude is not None else task.longitude
    if runner_lat is None or runner_lng is None:
        raise HTTPException(status_code=400, detail="请先开启定位后再确认取货")
    if pickup_lat is not None and pickup_lng is not None:
        dist = haversine_meters(runner_lat, runner_lng, pickup_lat, pickup_lng)
        if dist is not None and dist > PICKUP_CONFIRM_RADIUS_M:
            raise HTTPException(
                status_code=400,
                detail=f"你距离取货点约 {int(dist)} 米，需进入 {PICKUP_CONFIRM_RADIUS_M} 米内才能确认已取货",
            )

    task.delivery_phase = "delivering"
    task.picked_up_at = datetime.utcnow()
    if data and data.latitude is not None:
        task.runner_latitude = data.latitude
        task.runner_longitude = data.longitude
        task.runner_location_updated_at = datetime.utcnow()
        if data.eta_seconds is not None:
            task.eta_seconds = data.eta_seconds
        if data.distance_meters is not None:
            task.distance_meters = data.distance_meters
    create_notification(
        db,
        recipient_id=task.requester_id,
        actor_id=user.id,
        notification_type="task_picked_up",
        title="跑手已取货",
        content=f"“{task.title}”已取货，正在送往你填写的地址",
        target_type="service",
        target_id=task.id,
    )
    sync_service_order_status(db, task)
    db.commit()
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter_by(id=task_id).first()
    return {"message": "已确认取货，开始配送导航", "tracking": service_task_tracking_payload(task, user.id, db=db)}


@router.post("/tasks/{task_id}/complete")
def complete_task(
    task_id: int,
    data: Optional[TaskLocationBody] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if user.id not in {task.runner_id, task.requester_id}:
        raise HTTPException(status_code=403, detail="无权完成该任务")
    if task.status not in {"accepted", "in_progress"}:
        raise HTTPException(status_code=400, detail="任务状态不可完成")
    # Runner completing: soft check near delivery point
    if user.id == task.runner_id and data and data.latitude is not None and task.delivery_latitude is not None:
        dist = haversine_meters(data.latitude, data.longitude, task.delivery_latitude, task.delivery_longitude)
        if dist is not None and dist > DELIVERY_CONFIRM_RADIUS_M:
            raise HTTPException(
                status_code=400,
                detail=f"你距离送达点约 {int(dist)} 米，需进入 {DELIVERY_CONFIRM_RADIUS_M} 米内才能确认送达",
            )
        task.runner_latitude = data.latitude
        task.runner_longitude = data.longitude
        task.runner_location_updated_at = datetime.utcnow()
    task.status = "completed"
    task.delivery_phase = "delivered"
    task.completed_at = datetime.utcnow()
    task.eta_seconds = 0
    create_notification(
        db,
        recipient_id=task.requester_id if user.id == task.runner_id else task.runner_id,
        actor_id=user.id,
        notification_type="task_completed",
        title="跑腿任务已完成",
        content=f"“{task.title}”已送达完成，可在「我的订单」中评价",
        target_type="service",
        target_id=task.id,
    )
    sync_service_order_status(db, task)
    db.commit()
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter_by(id=task_id).first()
    return {"message": "任务已完成，可在我的订单中好评或投诉", "tracking": service_task_tracking_payload(task, user.id, db=db)}


@router.patch("/tasks/{task_id}/desired-time")
def update_desired_delivery_time(
    task_id: int,
    data: TaskDesiredTimeBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.requester_id != user.id:
        raise HTTPException(status_code=403, detail="仅发布者可修改期望送达时间")
    if task.status == "completed":
        raise HTTPException(status_code=400, detail="已完成任务不可修改时间")
    task.desired_delivery_at = data.desired_delivery_at
    task.deadline = data.desired_delivery_at
    if task.runner_id:
        create_notification(
            db,
            recipient_id=task.runner_id,
            actor_id=user.id,
            notification_type="task_time_updated",
            title="期望送达时间已更新",
            content=f"发布者更新了“{task.title}”的期望送达时间",
            target_type="service",
            target_id=task.id,
        )
    db.commit()
    return {"message": "期望送达时间已更新", "desired_delivery_at": task.desired_delivery_at}


@router.post("/tasks/{task_id}/late-complaint")
def complain_late_delivery(
    task_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.runner),
    ).filter_by(id=task_id).with_for_update().first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if not can_late_complain(task, user.id):
        raise HTTPException(status_code=400, detail="暂不可投诉：需超过约定送达时间 20 分钟且尚未投诉")
    task.late_complaint_at = datetime.utcnow()
    # Trust event: unique on (user_id, event_type, occurred_on) — use task-scoped event_type
    db.add(models.TrustScoreEvent(
        user_id=task.runner_id,
        event_type=f"late_task_{task.id}"[:40],
        points_delta=-20,
        reason=f"超时送达投诉：任务#{task.id} {task.title}"[:160],
        related_type="service",
        related_id=task.id,
        occurred_on=date.today(),
    ))
    create_notification(
        db,
        recipient_id=task.runner_id,
        actor_id=user.id,
        notification_type="task_late_complaint",
        title="超时送达投诉",
        content=f"任务“{task.title}”超时超过 20 分钟，信任分 -20",
        target_type="service",
        target_id=task.id,
    )
    db.commit()
    return {"message": "已提交超时投诉，跑手信任分 -20"}


@router.post("/community", status_code=201)
def create_community_post(
    data: CommunityPostCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    assert_can_post(user)
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
    assert_can_post(user)
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
    target_type = data.target_type or "listing"
    target_id = data.target_id or data.listing_id
    if not target_id:
        raise HTTPException(status_code=422, detail="缺少收藏内容标识")
    item = detail_payload(db, target_type, target_id, user)
    target_type = item["type"]
    favorite = db.query(models.ContentFavorite).filter_by(
        user_id=user.id,
        target_type=target_type,
        target_id=target_id,
    ).first()
    legacy = None
    if normalize_target_type(target_type) == "listing":
        legacy = db.query(models.Favorite).filter_by(
            user_id=user.id,
            listing_id=target_id,
        ).first()
    if favorite or legacy:
        if favorite:
            db.delete(favorite)
        if legacy:
            db.delete(legacy)
        db.commit()
        return {"message": "已取消收藏", "favorited": False, "target_type": target_type, "target_id": target_id}
    db.add(models.ContentFavorite(
        user_id=user.id,
        target_type=target_type,
        target_id=target_id,
    ))
    db.commit()
    return {"message": "收藏成功", "favorited": True, "target_type": target_type, "target_id": target_id}


@router.post("/orders/listing/{listing_id}", status_code=201)
def create_listing_order(
    listing_id: int,
    data: Optional[OrderPayBody] = Body(default=None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    listing = db.query(models.Listing).options(joinedload(models.Listing.images)).filter_by(id=listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="商品不存在")
    if listing.seller_id == user.id:
        raise HTTPException(status_code=400, detail="不能购买自己发布的商品")
    if listing.status != "available":
        raise HTTPException(status_code=409, detail="商品当前不可购买")
    body = data or OrderPayBody()
    order = models.Order(
        order_no=f"CM{datetime.now():%Y%m%d}{uuid4().hex[:10].upper()}",
        buyer_id=user.id,
        seller_id=listing.seller_id,
        listing_id=listing.id,
        amount=listing.price,
        status="pending_payment",
        delivery_method=body.delivery_method or "campus_meet",
        meeting_location=body.meeting_location,
        buyer_note=body.buyer_note,
    )
    listing.status = "reserved"
    db.add(order)
    db.flush()
    create_notification(
        db,
        recipient_id=listing.seller_id,
        actor_id=user.id,
        notification_type="order",
        title="有同学下单了你的商品",
        content=f"「{listing.title}」待对方付款 · 订单 {order.order_no}",
        target_type="order",
        target_id=order.id,
    )
    db.commit()
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order.id).first()
    return {
        "message": "订单已创建，请尽快完成校园支付确认",
        "order_no": order.order_no,
        "item": full_order_payload(db, order, user.id),
    }


@router.get("/detail/{item_type}/{item_id}")
def get_detail(
    item_type: str,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = detail_payload(db, item_type, item_id, user)
    item.update(content_metrics(db, user.id, item["type"], item["id"]))
    author_id = item["author"]["id"]
    item["author"]["is_following"] = is_following(db, user.id, author_id) if author_id != user.id else False
    item["author"]["is_muted"] = db.query(models.UserModeration).filter_by(
        user_id=user.id,
        target_user_id=author_id,
        action="mute",
    ).first() is not None
    item["author"]["is_blocked"] = db.query(models.UserModeration).filter_by(
        user_id=user.id,
        target_user_id=author_id,
        action="block",
    ).first() is not None
    item["can_message"] = author_id != user.id
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
        db.query(models.ContentFavorite).filter_by(target_type=target_type, target_id=item_id).delete()
        db.query(models.ContentComment).filter_by(target_type=target_type, target_id=item_id).delete()
        db.query(models.BrowseHistory).filter_by(item_type=target_type, item_id=item_id).delete()

    # Soft-delete when the model has status (keeps order FKs; profile counts stay in sync).
    # Community posts have no status field — hard delete.
    if hasattr(item, "status"):
        item.status = "deleted"
        db.commit()
        return {"message": "已删除发布内容"}

    try:
        db.delete(item)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="删除失败，请稍后重试")
    return {"message": "已删除发布内容"}


@router.post("/comments", status_code=201)
def create_comment(
    data: CommentCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    assert_can_comment(user)
    detail_payload(db, data.target_type, data.target_id, user)
    parent = db.get(models.ContentComment, data.parent_id) if data.parent_id else None
    if data.parent_id and not parent:
        raise HTTPException(status_code=404, detail="回复的评论不存在")
    if parent and (parent.target_type != data.target_type or parent.target_id != data.target_id):
        raise HTTPException(status_code=400, detail="不能跨内容回复评论")
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
    owner_id = content_owner_id(db, data.target_type, data.target_id)
    recipient_id = parent.user_id if parent and parent.user_id != user.id else owner_id
    if recipient_id and recipient_id != user.id:
        create_notification(
            db,
            recipient_id=recipient_id,
            actor_id=user.id,
            notification_type="comment_reply" if parent else "comment",
            title="有人回复了你" if parent else "你的发布收到新评论",
            content=data.content[:180],
            target_type=data.target_type,
            target_id=data.target_id,
        )
    db.commit()
    db.refresh(comment)
    return {
        "message": "留言成功",
        "id": comment.id,
        "comment": comment_payload(comment, {}, db, user.id),
    }


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    comment = db.get(models.ContentComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的评论")

    descendant_ids = []
    pending = [comment.id]
    while pending:
        children = db.query(models.ContentComment.id).filter(
            models.ContentComment.parent_id.in_(pending)
        ).all()
        pending = [row.id for row in children]
        descendant_ids.extend(pending)
    removed_ids = [comment.id, *descendant_ids]
    db.query(models.ContentReaction).filter(
        models.ContentReaction.target_type == "comment",
        models.ContentReaction.target_id.in_(removed_ids),
    ).delete(synchronize_session=False)
    for child_id in reversed(descendant_ids):
        child = db.get(models.ContentComment, child_id)
        if child:
            db.delete(child)
    db.delete(comment)
    db.flush()
    if comment.target_type == "community":
        post = db.get(models.CommunityPost, comment.target_id)
        if post:
            post.comment_count = db.query(models.ContentComment).filter_by(
                target_type="community",
                target_id=comment.target_id,
            ).count()
    db.commit()
    return {"message": "评论已删除", "id": comment_id, "removed_ids": removed_ids}


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
    owner_id = content_owner_id(db, source["type"], source["id"])
    if owner_id and owner_id != user.id:
        create_notification(
            db,
            recipient_id=owner_id,
            actor_id=user.id,
            notification_type="repost",
            title="你的发布被转发了",
            content=content[:180],
            target_type="community",
            target_id=None,
        )
    db.commit()
    return {"message": "已转发到校园社区", "id": post.id, "type": "community", "source_repost_count": source.get("repost_count", 0) + 1}


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = ensure_user_profile(db, user)
    trust = compute_trust(db, user.id)
    conversation_ids = [
        row.id for row in db.query(models.Conversation.id).filter(
            or_(models.Conversation.user_a_id == user.id, models.Conversation.user_b_id == user.id)
        ).all()
    ]
    unread_messages = 0
    if conversation_ids:
        unread_messages = db.query(models.Message).filter(
            models.Message.conversation_id.in_(conversation_ids),
            models.Message.sender_id != user.id,
            models.Message.is_read.is_(False),
        ).count()

    topics = [
        {"name": name, "count": int(count)}
        for name, count in db.query(
            models.CommunityPost.topic,
            func.count(models.CommunityPost.id),
        ).group_by(models.CommunityPost.topic).order_by(func.count(models.CommunityPost.id).desc()).limit(8).all()
        if name
    ]

    publisher_ids = []
    publisher_queries = [
        db.query(models.Listing.seller_id).order_by(models.Listing.created_at.desc()).limit(30).all(),
        db.query(models.ServiceTask.requester_id).order_by(models.ServiceTask.created_at.desc()).limit(30).all(),
        db.query(models.WantedPost.user_id).order_by(models.WantedPost.created_at.desc()).limit(30).all(),
        db.query(models.CommunityPost.author_id).order_by(models.CommunityPost.created_at.desc()).limit(30).all(),
    ]
    for rows in publisher_queries:
        for row in rows:
            candidate_id = row[0]
            if candidate_id != user.id and candidate_id not in publisher_ids:
                publisher_ids.append(candidate_id)
    hidden_ids = {
        row.target_user_id for row in db.query(models.UserModeration).filter(
            models.UserModeration.user_id == user.id,
            models.UserModeration.action == "block",
        ).all()
    }
    publisher_ids = [candidate_id for candidate_id in publisher_ids if candidate_id not in hidden_ids]
    nearby_users = []
    if publisher_ids:
        users = db.query(models.User).options(joinedload(models.User.profile)).filter(
            models.User.id.in_(publisher_ids),
            models.User.is_active.is_(True),
        ).all()
        user_map = {candidate.id: candidate for candidate in users}
        for candidate_id in publisher_ids:
            candidate = user_map.get(candidate_id)
            if not candidate:
                continue
            payload = user_payload(candidate)
            payload["trust"] = compute_trust(db, candidate.id)
            payload["is_following"] = is_following(db, user.id, candidate.id)
            nearby_users.append(payload)
        nearby_users.sort(
            key=lambda item: (
                item["is_online"],
                item["last_active_at"].timestamp() if item.get("last_active_at") else 0,
            ),
            reverse=True,
        )

    # Right-rail "my orders" must hide soft-deleted records for this user
    recent_order = db.query(models.Order).options(
        joinedload(models.Order.listing),
        joinedload(models.Order.service_task),
    ).filter(
        or_(
            (models.Order.buyer_id == user.id) & (models.Order.buyer_deleted.is_(False)),
            (models.Order.seller_id == user.id) & (models.Order.seller_deleted.is_(False)),
        )
    ).order_by(models.Order.created_at.desc()).first()
    active_errand_rows = db.query(models.ServiceTask).options(
        joinedload(models.ServiceTask.requester).joinedload(models.User.profile),
        joinedload(models.ServiceTask.runner).joinedload(models.User.profile),
    ).filter(
        models.ServiceTask.status.in_(["accepted", "in_progress"]),
        or_(
            models.ServiceTask.requester_id == user.id,
            models.ServiceTask.runner_id == user.id,
        ),
    ).order_by(models.ServiceTask.accepted_at.desc(), models.ServiceTask.created_at.desc()).limit(8).all()
    active_errands = [service_task_tracking_payload(task, user.id, db=db) for task in active_errand_rows]
    return {
        "active_listings": db.query(models.Listing).filter(models.Listing.status == "available").count(),
        "open_tasks": db.query(models.ServiceTask).filter(models.ServiceTask.status == "open").count(),
        "community_posts": db.query(models.CommunityPost).count(),
        "my_orders": db.query(models.Order).filter(
            or_(models.Order.buyer_id == user.id, models.Order.seller_id == user.id)
        ).count() + len(active_errands),
        "unread_messages": unread_messages,
        "unread_notifications": db.query(models.Notification).filter_by(
            recipient_id=user.id,
            is_read=False,
        ).count(),
        "topics": topics,
        "nearby_users": nearby_users[:5],
        "active_errands": active_errands,
        "recent_order": compact_order_payload(
            recent_order,
            "buyer" if recent_order and recent_order.buyer_id == user.id else "seller",
        ) if recent_order else None,
        "profile": {
            "nickname": profile.nickname or user.username,
            "avatar_url": profile.avatar_url,
            "school": profile.school or "未选择学校",
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

    favorite_rows = db.query(models.ContentFavorite).filter_by(user_id=user.id).order_by(
        models.ContentFavorite.created_at.desc()
    ).limit(20).all()
    favorites = []
    favorite_keys = set()
    for favorite in favorite_rows:
        try:
            item = detail_payload(db, favorite.target_type, favorite.target_id, user)
        except HTTPException:
            continue
        favorites.append(compact_content_payload(item))
        favorite_keys.add((normalize_target_type(item["type"]), item["id"]))

    legacy_rows = db.query(models.Favorite).filter_by(user_id=user.id).order_by(
        models.Favorite.created_at.desc()
    ).limit(20).all()
    legacy_ids = [row.listing_id for row in legacy_rows if ("listing", row.listing_id) not in favorite_keys]
    if legacy_ids:
        listings = db.query(models.Listing).options(joinedload(models.Listing.images)).filter(
            models.Listing.id.in_(legacy_ids)
        ).all()
        listing_map = {listing.id: listing for listing in listings}
        favorites.extend(
            compact_listing_payload(listing_map[item_id])
            for item_id in legacy_ids
            if item_id in listing_map
        )

    follower_rows = db.query(models.UserFollow).options(
        joinedload(models.UserFollow.follower).joinedload(models.User.profile)
    ).filter_by(following_id=user.id).order_by(models.UserFollow.created_at.desc()).limit(50).all()
    following_rows = db.query(models.UserFollow).options(
        joinedload(models.UserFollow.following).joinedload(models.User.profile)
    ).filter_by(follower_id=user.id).order_by(models.UserFollow.created_at.desc()).limit(50).all()
    profile.follower_count = len(follower_rows)
    profile.following_count = len(following_rows)
    db.commit()

    published = {
        "listings": [
            compact_listing_payload(item)
            for item in db.query(models.Listing).options(joinedload(models.Listing.images)).filter(
                models.Listing.seller_id == user.id,
                models.Listing.status != "deleted",
            ).order_by(models.Listing.created_at.desc()).limit(12)
        ],
        "services": [
            {"id": item.id, "type": "service", "title": item.title, "status": item.status, "price_label": f"¥{float(item.reward):.0f}", "created_at": item.created_at}
            for item in db.query(models.ServiceTask).filter(
                models.ServiceTask.requester_id == user.id,
                models.ServiceTask.status != "deleted",
            ).order_by(models.ServiceTask.created_at.desc()).limit(12)
        ],
        "wanted": [
            {"id": item.id, "type": "wanted", "title": item.title, "status": item.status, "price_label": f"预算 ¥{float(item.budget_max):.0f}" if item.budget_max else "预算面议", "created_at": item.created_at}
            for item in db.query(models.WantedPost).filter(
                models.WantedPost.user_id == user.id,
                models.WantedPost.status != "deleted",
            ).order_by(models.WantedPost.created_at.desc()).limit(12)
        ],
        "posts": [
            {"id": item.id, "type": "community", "title": item.title or item.content[:24], "status": item.topic, "price_label": None, "image_url": item.image_url, "created_at": item.created_at}
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
            "school": profile.school or "未选择学校",
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
        "followers_list": [user_payload(row.follower) for row in follower_rows],
        "following_list": [user_payload(row.following) for row in following_rows],
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


def sync_follow_counts(db: Session, *user_ids: int):
    for user_id in set(user_ids):
        profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
        if not profile:
            continue
        profile.follower_count = db.query(models.UserFollow).filter_by(following_id=user_id).count()
        profile.following_count = db.query(models.UserFollow).filter_by(follower_id=user_id).count()


@router.post("/relationships/follow/{target_user_id}")
def toggle_follow_user(
    target_user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if target_user_id == user.id:
        raise HTTPException(status_code=400, detail="不能关注自己")
    target = db.get(models.User, target_user_id)
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")
    existing = db.query(models.UserFollow).filter_by(
        follower_id=user.id,
        following_id=target_user_id,
    ).first()
    if existing:
        db.delete(existing)
        followed = False
        message = "已取消关注"
    else:
        db.add(models.UserFollow(follower_id=user.id, following_id=target_user_id))
        create_notification(
            db,
            recipient_id=target_user_id,
            actor_id=user.id,
            notification_type="follow",
            title="你有新的关注者",
            content=f"{user.username} 关注了你",
            target_type="user",
            target_id=user.id,
        )
        followed = True
        message = "关注成功"
    db.flush()
    sync_follow_counts(db, user.id, target_user_id)
    db.commit()
    return {
        "message": message,
        "followed": followed,
        "target_follower_count": db.query(models.UserFollow).filter_by(following_id=target_user_id).count(),
        "my_following_count": db.query(models.UserFollow).filter_by(follower_id=user.id).count(),
    }


@router.post("/relationships/{action}/{target_user_id}")
def toggle_user_moderation(
    action: Literal["mute", "block"],
    target_user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if target_user_id == user.id:
        raise HTTPException(status_code=400, detail="不能对自己执行此操作")
    if not db.get(models.User, target_user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
    existing = db.query(models.UserModeration).filter_by(
        user_id=user.id,
        target_user_id=target_user_id,
        action=action,
    ).first()
    if existing:
        db.delete(existing)
        enabled = False
    else:
        db.add(models.UserModeration(
            user_id=user.id,
            target_user_id=target_user_id,
            action=action,
        ))
        enabled = True
        if action == "block":
            db.query(models.UserFollow).filter(or_(
                (models.UserFollow.follower_id == user.id) & (models.UserFollow.following_id == target_user_id),
                (models.UserFollow.follower_id == target_user_id) & (models.UserFollow.following_id == user.id),
            )).delete(synchronize_session=False)
    sync_follow_counts(db, user.id, target_user_id)
    db.commit()
    label = "拉黑" if action == "block" else "屏蔽"
    return {"message": f"已{label}" if enabled else f"已取消{label}", "enabled": enabled, "action": action}


@router.post("/reports", status_code=201)
def create_report(
    data: ReportCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if data.target_type == "comment":
        target = db.get(models.ContentComment, data.target_id)
        owner_id = target.user_id if target else None
    else:
        owner_id = content_owner_id(db, data.target_type, data.target_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="举报对象不存在")
    if owner_id == user.id:
        raise HTTPException(status_code=400, detail="不能举报自己的内容")
    duplicate = db.query(models.Report).filter_by(
        reporter_id=user.id,
        target_type=data.target_type,
        target_id=data.target_id,
        status="pending",
    ).first()
    if duplicate:
        return {"message": "该举报已提交，正在等待平台核实", "id": duplicate.id}
    report = models.Report(reporter_id=user.id, **data.model_dump())
    db.add(report)
    db.flush()
    create_notification(
        db,
        recipient_id=owner_id,
        actor_id=user.id,
        notification_type="report_received",
        title="你的内容收到一条举报",
        content="平台会先核实事实，待处理举报不会直接影响信任分。",
        target_type=data.target_type,
        target_id=data.target_id,
    )
    reporter_name = user.username
    profile = getattr(user, "profile", None)
    if profile and profile.nickname:
        reporter_name = profile.nickname
    for admin in db.query(models.User).filter(models.User.is_admin.is_(True), models.User.is_active.is_(True)).all():
        create_notification(
            db,
            recipient_id=admin.id,
            actor_id=user.id,
            notification_type="admin_report",
            title="【管理后台】收到新举报",
            content=f"{reporter_name} 举报了 {data.target_type}#{data.target_id}，原因：{data.reason}",
            target_type="report",
            target_id=report.id,
        )
    db.commit()
    return {"message": "举报已提交，平台核实前不会直接扣除对方信任分", "id": report.id}


@router.get("/notifications")
def get_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = db.query(models.Notification).options(
        joinedload(models.Notification.actor).joinedload(models.User.profile)
    ).filter_by(recipient_id=user.id).order_by(models.Notification.created_at.desc()).limit(limit).all()
    actor_ids = {row.actor_id for row in rows if row.actor_id}
    following_ids = set()
    if actor_ids:
        following_ids = {
            row.following_id
            for row in db.query(models.UserFollow).filter(
                models.UserFollow.follower_id == user.id,
                models.UserFollow.following_id.in_(actor_ids),
            ).all()
        }
    return {
        "items": [{
            "id": row.id,
            "type": row.notification_type,
            "title": row.title,
            "content": row.content,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "is_read": row.is_read,
            "actor": user_payload(row.actor) if row.actor else None,
            "is_following_actor": bool(row.actor_id and row.actor_id in following_ids),
            "created_at": row.created_at,
        } for row in rows],
        "unread": sum(1 for row in rows if not row.is_read),
    }


@router.post("/notifications/read-all")
def read_all_notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter_by(recipient_id=user.id, is_read=False).update({"is_read": True})
    db.commit()
    return {"message": "通知已全部标为已读"}


@router.post("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    notification = db.get(models.Notification, notification_id)
    if not notification or notification.recipient_id != user.id:
        raise HTTPException(status_code=404, detail="通知不存在")
    notification.is_read = True
    db.commit()
    return {"message": "通知已读"}


@router.get("/users/{target_user_id}")
def get_public_user_profile(
    target_user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    target = db.query(models.User).options(joinedload(models.User.profile)).filter_by(id=target_user_id).first()
    if not target or not target.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")
    profile = ensure_user_profile(db, target)
    published = [
        compact_listing_payload(item)
        for item in db.query(models.Listing).options(joinedload(models.Listing.images)).filter(
            models.Listing.seller_id == target.id,
            models.Listing.status != "deleted",
        ).order_by(models.Listing.created_at.desc()).limit(12).all()
    ]
    published.extend({
        "id": item.id,
        "type": "service",
        "title": item.title,
        "status": item.status,
        "price_label": f"赏金 ¥{float(item.reward):.0f}",
        "image_url": item.image_url,
        "created_at": item.created_at,
    } for item in db.query(models.ServiceTask).filter(
        models.ServiceTask.requester_id == target.id,
        models.ServiceTask.status != "deleted",
    ).order_by(models.ServiceTask.created_at.desc()).limit(8).all())
    published.extend({
        "id": item.id,
        "type": "wanted",
        "title": item.title,
        "status": item.status,
        "price_label": f"预算 ¥{float(item.budget_max):.0f}" if item.budget_max else "预算面议",
        "image_url": item.image_url,
        "created_at": item.created_at,
    } for item in db.query(models.WantedPost).filter(
        models.WantedPost.user_id == target.id,
        models.WantedPost.status != "deleted",
    ).order_by(models.WantedPost.created_at.desc()).limit(8).all())
    published.extend({
        "id": item.id,
        "type": "community",
        "title": item.title or item.content[:40],
        "status": item.topic,
        "price_label": None,
        "image_url": item.image_url,
        "created_at": item.created_at,
    } for item in db.query(models.CommunityPost).filter_by(author_id=target.id).order_by(models.CommunityPost.created_at.desc()).limit(8).all())
    published.sort(key=lambda item: item.get("created_at") or datetime.min, reverse=True)
    return {
        "user": user_payload(target),
        "profile": {
            "nickname": profile.nickname or target.username,
            "avatar_url": profile.avatar_url,
            "background_url": profile.background_url,
            "background_theme": profile.background_theme or "teal",
            "school": profile.school or "未选择学校",
            "signature": profile.signature or "",
            "followers": db.query(models.UserFollow).filter_by(following_id=target.id).count(),
            "following": db.query(models.UserFollow).filter_by(follower_id=target.id).count(),
        },
        "trust": compute_trust(db, target.id),
        "is_following": is_following(db, user.id, target.id),
        "is_me": user.id == target.id,
        "published": published[:40],
        "published_groups": {
            "listing": [item for item in published if item.get("type") == "listing"],
            "game": [item for item in published if item.get("type") == "game"],
            "service": [item for item in published if item.get("type") == "service"],
            "wanted": [item for item in published if item.get("type") == "wanted"],
            "community": [item for item in published if item.get("type") == "community"],
        },
    }


def conversation_payload(db: Session, conversation: models.Conversation, current_user_id: int):
    other_id = conversation.user_b_id if conversation.user_a_id == current_user_id else conversation.user_a_id
    other = db.query(models.User).options(joinedload(models.User.profile)).filter_by(id=other_id).first()
    last_message = db.query(models.Message).options(
        joinedload(models.Message.sender).joinedload(models.User.profile)
    ).filter_by(conversation_id=conversation.id).order_by(models.Message.created_at.desc()).first()
    unread = db.query(models.Message).filter(
        models.Message.conversation_id == conversation.id,
        models.Message.sender_id != current_user_id,
        models.Message.is_read.is_(False),
    ).count()
    context = None
    if conversation.context_type and conversation.context_id:
        try:
            detail = detail_payload(db, conversation.context_type, conversation.context_id, db.get(models.User, current_user_id))
            context = compact_content_payload(detail)
        except HTTPException:
            context = None
    if other:
        user_data = user_payload(other)
    else:
        user_data = {
            "id": other_id,
            "username": "已注销用户",
            "email": None,
            "avatar_url": None,
            "nickname": "已注销用户",
            "school": None,
            "is_online": False,
            "last_active_at": None,
        }
    return {
        "id": conversation.id,
        "user": user_data,
        "last_message": message_payload(db, last_message, current_user_id) if last_message else None,
        "unread": unread,
        "context": context,
        "updated_at": conversation.updated_at,
    }


@router.post("/conversations/start", status_code=201)
def start_conversation(
    data: ConversationStart,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conversation = find_or_create_conversation(
        db,
        user.id,
        data.target_user_id,
        data.context_type,
        data.context_id,
    )
    db.commit()
    db.refresh(conversation)
    return conversation_payload(db, conversation, user.id)


@router.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = db.query(models.Conversation).filter(
        or_(models.Conversation.user_a_id == user.id, models.Conversation.user_b_id == user.id)
    ).order_by(models.Conversation.updated_at.desc()).all()
    return {"items": [conversation_payload(db, row, user.id) for row in rows]}


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conversation = get_conversation_for_user(db, conversation_id, user.id)
    db.query(models.Message).filter(
        models.Message.conversation_id == conversation.id,
        models.Message.sender_id != user.id,
        models.Message.is_read.is_(False),
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    rows = db.query(models.Message).options(
        joinedload(models.Message.sender).joinedload(models.User.profile),
        joinedload(models.Message.reply_to).joinedload(models.Message.sender).joinedload(models.User.profile),
    ).filter_by(conversation_id=conversation.id).order_by(models.Message.created_at.asc()).limit(300).all()
    return {"items": [message_payload(db, row, user.id) for row in rows]}


@router.post("/conversations/{conversation_id}/messages", status_code=201)
def send_conversation_message(
    conversation_id: int,
    data: MessageCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conversation = get_conversation_for_user(db, conversation_id, user.id)
    if data.reply_to_id:
        reply = db.get(models.Message, data.reply_to_id)
        if not reply or reply.conversation_id != conversation.id:
            raise HTTPException(status_code=400, detail="引用消息不属于当前会话")
    recipient_id = conversation.user_b_id if conversation.user_a_id == user.id else conversation.user_a_id
    blocked = db.query(models.UserModeration).filter(
        models.UserModeration.action == "block",
        or_(
            (models.UserModeration.user_id == user.id) & (models.UserModeration.target_user_id == recipient_id),
            (models.UserModeration.user_id == recipient_id) & (models.UserModeration.target_user_id == user.id),
        ),
    ).first()
    if blocked:
        raise HTTPException(status_code=403, detail="当前无法向该用户发送私信")
    message = models.Message(
        conversation_id=conversation.id,
        sender_id=user.id,
        content=data.content,
        message_type=data.message_type,
        metadata_json=json.dumps(data.metadata, ensure_ascii=False) if data.metadata else None,
        reply_to_id=data.reply_to_id,
    )
    conversation.updated_at = func.now()
    db.add(message)
    db.flush()
    muted = db.query(models.UserModeration).filter_by(
        user_id=recipient_id,
        target_user_id=user.id,
        action="mute",
    ).first()
    if not muted:
        if data.message_type == "image":
            preview = "发来一张图片"
        elif data.message_type == "product":
            preview = "分享了一个商品卡片"
        elif data.message_type == "order":
            preview = data.content[:120]
        else:
            preview = data.content[:120]
        create_notification(
            db,
            recipient_id=recipient_id,
            actor_id=user.id,
            notification_type="message",
            title="收到一条新私信",
            content=preview,
            target_type="conversation",
            target_id=conversation.id,
        )
    db.commit()
    db.refresh(message)
    return {"message": "发送成功", "item": message_payload(db, message, user.id)}


@router.post("/messages/{message_id}/reactions")
def toggle_message_reaction(
    message_id: int,
    data: MessageReactionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    message = db.query(models.Message).options(
        joinedload(models.Message.sender).joinedload(models.User.profile)
    ).filter_by(id=message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    get_conversation_for_user(db, message.conversation_id, user.id)
    existing = db.query(models.MessageReaction).filter_by(
        message_id=message.id,
        user_id=user.id,
        emoji=data.emoji,
    ).first()
    if existing:
        db.delete(existing)
    else:
        db.add(models.MessageReaction(message_id=message.id, user_id=user.id, emoji=data.emoji))
    db.commit()
    db.refresh(message)
    return {"message": "消息表情已更新", "item": message_payload(db, message, user.id)}


@router.get("/orders")
def list_my_orders(
    role: str = Query(default="all"),
    status: str = Query(default="all"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    )
    if role == "buyer":
        query = query.filter(models.Order.buyer_id == user.id, models.Order.buyer_deleted.is_(False))
    elif role == "seller":
        query = query.filter(models.Order.seller_id == user.id, models.Order.seller_deleted.is_(False))
    else:
        query = query.filter(
            or_(
                (models.Order.buyer_id == user.id) & (models.Order.buyer_deleted.is_(False)),
                (models.Order.seller_id == user.id) & (models.Order.seller_deleted.is_(False)),
            )
        )
    if status != "all":
        query = query.filter(models.Order.status == status)
    rows = query.order_by(models.Order.created_at.desc()).limit(100).all()
    items = []
    for row in rows:
        try:
            items.append(full_order_payload(db, row, user.id))
        except Exception:
            # Never blank the whole list because one order failed to serialize
            try:
                db.rollback()
            except Exception:
                pass
            items.append(compact_order_payload(row, "buyer" if row.buyer_id == user.id else "seller"))
    return {"items": items}


@router.get("/orders/{order_id}")
def get_order_detail(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or user.id not in {order.buyer_id, order.seller_id}:
        raise HTTPException(status_code=404, detail="订单不存在")
    return {"item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/pay")
def pay_order(
    order_id: int,
    data: Optional[OrderPayBody] = Body(default=None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or order.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status not in {"pending_payment", "pending_confirm"}:
        raise HTTPException(status_code=409, detail="当前订单状态不可付款")
    body = data or OrderPayBody()
    order.status = "pending_ship"
    order.paid_at = datetime.utcnow()
    if body.buyer_note:
        order.buyer_note = body.buyer_note
    if body.meeting_location:
        order.meeting_location = body.meeting_location
    if body.delivery_method:
        order.delivery_method = body.delivery_method
    if order.listing:
        order.listing.status = "sold_pending"
    title = order.listing.title if order.listing else "校园订单"
    amount = float(order.amount)
    meta = {
        "order_id": order.id,
        "order_no": order.order_no,
        "amount": amount,
        "title": title,
        "image_url": order.listing.images[0].image_url if order.listing and order.listing.images else None,
        "status": order.status,
        "event": "paid",
    }
    conversation, _ = send_order_system_message(
        db,
        order,
        user.id,
        f"我已完成付款 ¥{amount:.2f}，请尽快安排校内交付/发货。",
        meta,
    )
    create_notification(
        db,
        recipient_id=order.seller_id,
        actor_id=user.id,
        notification_type="order",
        title="买家已付款",
        content=f"「{title}」已付款 ¥{amount:.2f}，请及时发货。",
        target_type="order",
        target_id=order.id,
    )
    create_notification(
        db,
        recipient_id=order.seller_id,
        actor_id=user.id,
        notification_type="message",
        title="订单消息",
        content=f"买家已付款 ¥{amount:.2f}",
        target_type="conversation",
        target_id=conversation.id,
    )
    db.commit()
    db.refresh(order)
    return {"message": "付款成功，已通知卖家", "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/ship")
def ship_order(
    order_id: int,
    data: Optional[OrderShipBody] = Body(default=None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or order.seller_id != user.id:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "pending_ship":
        raise HTTPException(status_code=409, detail="当前订单状态不可发货")
    body = data or OrderShipBody()
    order.status = "shipped"
    order.shipped_at = datetime.utcnow()
    if body.meeting_location:
        order.meeting_location = body.meeting_location
    if body.seller_note:
        order.seller_note = body.seller_note
    title = order.listing.title if order.listing else "校园订单"
    meta = {
        "order_id": order.id,
        "order_no": order.order_no,
        "amount": float(order.amount),
        "title": title,
        "image_url": order.listing.images[0].image_url if order.listing and order.listing.images else None,
        "status": order.status,
        "event": "shipped",
        "meeting_location": order.meeting_location,
    }
    conversation, _ = send_order_system_message(
        db,
        order,
        user.id,
        f"订单已发货/安排交付：{order.meeting_location or '请到订单详情查看交付方式'}。",
        meta,
    )
    create_notification(
        db,
        recipient_id=order.buyer_id,
        actor_id=user.id,
        notification_type="order",
        title="卖家已发货",
        content=f"「{title}」已发货，可在订单详情查看。",
        target_type="order",
        target_id=order.id,
    )
    create_notification(
        db,
        recipient_id=order.buyer_id,
        actor_id=user.id,
        notification_type="message",
        title="订单消息",
        content="卖家已发货，点击查看订单",
        target_type="conversation",
        target_id=conversation.id,
    )
    db.commit()
    db.refresh(order)
    return {"message": "已标记发货，已通知买家", "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/receive")
def receive_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or order.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "shipped":
        raise HTTPException(status_code=409, detail="当前订单状态不可确认收货")
    order.status = "completed"
    order.received_at = datetime.utcnow()
    order.completed_at = datetime.utcnow()
    if order.listing:
        order.listing.status = "sold"
    title = order.listing.title if order.listing else "校园订单"
    meta = {
        "order_id": order.id,
        "order_no": order.order_no,
        "amount": float(order.amount),
        "title": title,
        "status": order.status,
        "event": "received",
    }
    send_order_system_message(db, order, user.id, "我已确认收货，本单交易完成，感谢本次校园交易。", meta)
    create_notification(
        db,
        recipient_id=order.seller_id,
        actor_id=user.id,
        notification_type="order",
        title="买家已确认收货",
        content=f"「{title}」交易完成。",
        target_type="order",
        target_id=order.id,
    )
    db.commit()
    db.refresh(order)
    return {"message": "已确认收货，交易完成", "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/after-sales")
async def apply_after_sale(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Flexible body parse — avoid opaque 422 when clients send slightly different shapes
    raw: dict = {}
    try:
        raw = await request.json()
        if not isinstance(raw, dict):
            raw = {}
    except Exception:
        raw = {}
    reason = str(
        raw.get("reason")
        or raw.get("content")
        or raw.get("message")
        or raw.get("description")
        or ""
    ).strip()
    if len(reason) < 2:
        raise HTTPException(status_code=400, detail="请填写至少 2 个字的售后原因")
    if len(reason) > 500:
        reason = reason[:500]

    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
        joinedload(models.Order.service_task),
    ).filter_by(id=order_id).first()
    if not order or order.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="订单不存在")
    # Only block true service/errand orders; allow goods orders even if listing_id is missing
    if order.service_task_id or getattr(order, "service_task", None):
        raise HTTPException(status_code=400, detail="跑腿订单暂不支持退货售后")
    if order.status not in {"pending_ship", "shipped", "completed"}:
        raise HTTPException(
            status_code=409,
            detail=f"当前订单状态（{order_status_label(order.status, 'buyer')}）不可申请售后，需已付款后",
        )
    active = db.query(models.AfterSaleRequest).filter(
        models.AfterSaleRequest.order_id == order.id,
        models.AfterSaleRequest.status.in_(["pending_seller", "admin_pending"]),
    ).first()
    if active:
        raise HTTPException(status_code=409, detail="已有售后申请正在处理中")

    after_req = models.AfterSaleRequest(
        order_id=order.id, applicant_id=user.id, reason=reason, status="pending_seller",
    )
    db.add(after_req)
    title = (
        (order.listing.title if order.listing else None)
        or order.order_no
        or f"订单#{order.id}"
    )
    create_notification(
        db, recipient_id=order.seller_id, actor_id=user.id, notification_type="order",
        title="【售后申请】买家申请退货退款", content=f"订单「{title}」：{reason}",
        target_type="order", target_id=order.id,
    )
    # Also open a support ticket + notify admins so 客服 can see it immediately
    ticket = models.SupportTicket(
        user_id=user.id,
        order_id=order.id,
        category="after_sale",
        title=f"售后申请 {order.order_no or order.id}",
        content=f"买家提交退货退款申请（等待卖家协商）。原因：{reason}",
        status="pending",
    )
    db.add(ticket)
    for admin in db.query(models.User).filter(
        models.User.is_admin.is_(True), models.User.is_active.is_(True)
    ).all():
        create_notification(
            db, recipient_id=admin.id, actor_id=user.id, notification_type="order",
            title="【售后待跟进】新的退货退款申请",
            content=f"订单「{title}」买家申请售后：{reason}",
            target_type="order", target_id=order.id,
        )
    db.commit()
    db.refresh(order)
    return {"message": "售后申请已提交，已通知卖家与平台客服", "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/after-sales/respond")
def respond_after_sale(
    order_id: int,
    data: AfterSaleResponseBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or order.seller_id != user.id:
        raise HTTPException(status_code=404, detail="订单不存在")
    request = db.query(models.AfterSaleRequest).filter_by(order_id=order.id, status="pending_seller").order_by(
        models.AfterSaleRequest.created_at.desc()
    ).first()
    if not request:
        raise HTTPException(status_code=409, detail="当前没有待处理的售后申请")
    request.seller_response = (data.response or "").strip() or None
    request.responded_at = datetime.utcnow()
    title = order.listing.title if order.listing else order.order_no
    if data.agree:
        request.status = "refunded"
        order.status = "refunded"
        order.refunded_at = datetime.utcnow()
        if order.listing:
            order.listing.status = "available"
        content = f"卖家已同意售后，订单「{title}」已标记退款完成。"
        message = "售后已协商完成，退款状态已更新"
    else:
        request.status = "admin_pending"
        ticket = models.SupportTicket(
            user_id=order.buyer_id, order_id=order.id, category="after_sale",
            title=f"售后争议 {order.order_no}",
            content=f"卖家拒绝售后。买家申请：{request.reason}。卖家说明：{request.seller_response or '未填写'}",
            status="pending",
        )
        db.add(ticket)
        content = f"卖家未同意售后，已自动提交客服裁定。{request.seller_response or ''}".strip()
        message = "已拒绝售后，客服工单已创建"
        for admin in db.query(models.User).filter(
            models.User.is_admin.is_(True), models.User.is_active.is_(True)
        ).all():
            create_notification(
                db, recipient_id=admin.id, actor_id=user.id, notification_type="order",
                title="【售后裁定】卖家拒绝，请客服处理",
                content=f"订单「{title}」进入客服裁定：{request.reason}",
                target_type="order", target_id=order.id,
            )
    create_notification(
        db, recipient_id=order.buyer_id, actor_id=user.id, notification_type="order",
        title="【售后进度】" + ("卖家已同意退款" if data.agree else "售后已转客服裁定"),
        content=content, target_type="order", target_id=order.id,
    )
    db.commit()
    db.refresh(order)
    return {"message": message, "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/cancel")
def cancel_order(
    order_id: int,
    reason: str = Query(default="双方协商取消"),
    data: Optional[OrderCancelBody] = Body(default=None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or user.id not in {order.buyer_id, order.seller_id}:
        raise HTTPException(status_code=404, detail="订单不存在")
    is_service = bool(order.service_task_id)
    # 跑腿单进行中也可双方取消；普通商品 shipped 后不可取消
    if order.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=409, detail="当前订单状态不可取消")
    if not is_service and order.status == "shipped":
        raise HTTPException(status_code=409, detail="当前订单状态不可取消")
    cancel_text = (data.reason if data and data.reason else reason)[:240]
    order.status = "cancelled"
    order.cancel_reason = cancel_text
    order.cancelled_by_id = user.id
    if order.listing and order.listing.status in {"reserved", "pending", "sold_pending"}:
        order.listing.status = "available"
    if order.service_task:
        order.service_task.status = "cancelled"
        order.service_task.delivery_phase = "pending"
    peer_id = order.seller_id if user.id == order.buyer_id else order.buyer_id
    create_notification(
        db,
        recipient_id=peer_id,
        actor_id=user.id,
        notification_type="order",
        title="订单已取消",
        content=f"{cancel_text}。可在「我的订单」中选择投诉或不投诉。",
        target_type="order",
        target_id=order.id,
    )
    db.commit()
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    return {"message": "订单已取消，对方可选择投诉或跳过", "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/review")
def review_order(
    order_id: int,
    data: OrderReviewBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    order = db.query(models.Order).options(
        joinedload(models.Order.service_task),
        joinedload(models.Order.listing),
    ).filter_by(id=order_id).first()
    if not order or user.id not in {order.buyer_id, order.seller_id}:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status not in {"completed", "cancelled"}:
        raise HTTPException(status_code=409, detail="仅已完成或已取消订单可评价")
    exists = db.query(models.Review).filter_by(order_id=order.id, reviewer_id=user.id).first()
    if exists:
        raise HTTPException(status_code=409, detail="你已评价过该订单")
    reviewed_user_id = order.seller_id if user.id == order.buyer_id else order.buyer_id
    rating = data.rating
    if data.is_complaint:
        rating = min(rating, 2)
    is_complaint = bool(data.is_complaint or rating <= 2)
    review = models.Review(
        order_id=order.id,
        reviewer_id=user.id,
        reviewed_user_id=reviewed_user_id,
        rating=rating,
        content=(data.content or ("投诉本次交易" if is_complaint else "好评")).strip()[:500],
        is_complaint=is_complaint,
    )
    db.add(review)
    # 信任分事件：好评 +8，投诉/差评 -20
    if is_complaint:
        db.add(models.TrustScoreEvent(
            user_id=reviewed_user_id,
            event_type=f"order_complaint_{order.id}"[:40],
            points_delta=-20,
            reason=f"订单投诉：{order.order_no}"[:160],
            related_type="order",
            related_id=order.id,
            occurred_on=date.today(),
        ))
        create_notification(
            db,
            recipient_id=reviewed_user_id,
            actor_id=user.id,
            notification_type="order_review",
            title="你收到一则交易投诉",
            content=(review.content or "对方对本次订单提出投诉，信任分 -20") + "。若觉得不公，可在订单中申诉。",
            target_type="order",
            target_id=order.id,
        )
        message = "已提交投诉，对方信任分 -20"
    else:
        if rating >= 4:
            db.add(models.TrustScoreEvent(
                user_id=reviewed_user_id,
                event_type=f"order_praise_{order.id}"[:40],
                points_delta=8,
                reason=f"订单好评：{order.order_no}"[:160],
                related_type="order",
                related_id=order.id,
                occurred_on=date.today(),
            ))
        create_notification(
            db,
            recipient_id=reviewed_user_id,
            actor_id=user.id,
            notification_type="order_review",
            title="你收到一则交易评价",
            content=f"{rating} 星：{review.content or '好评'}",
            target_type="order",
            target_id=order.id,
        )
        message = "评价成功，感谢反馈"
    db.commit()
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    return {
        "message": message,
        "trust": compute_trust(db, reviewed_user_id),
        "item": full_order_payload(db, order, user.id),
    }


@router.post("/orders/{order_id}/skip-review")
def skip_order_review(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """取消后选择不投诉：写入中性评价占位，避免反复弹窗。"""
    order = db.get(models.Order, order_id)
    if not order or user.id not in {order.buyer_id, order.seller_id}:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status not in {"completed", "cancelled"}:
        raise HTTPException(status_code=409, detail="当前订单无需跳过评价")
    exists = db.query(models.Review).filter_by(order_id=order.id, reviewer_id=user.id).first()
    if exists:
        return {"message": "已处理过评价", "item": full_order_payload(db, order, user.id)}
    reviewed_user_id = order.seller_id if user.id == order.buyer_id else order.buyer_id
    db.add(models.Review(
        order_id=order.id,
        reviewer_id=user.id,
        reviewed_user_id=reviewed_user_id,
        rating=3,
        content="不投诉/暂不评价",
        is_complaint=False,
    ))
    db.commit()
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    return {"message": "已选择不投诉", "item": full_order_payload(db, order, user.id)}


@router.post("/orders/{order_id}/delete-record")
def delete_order_record(
    order_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """软删除：仅对自己隐藏已完成/已取消订单记录，不影响对方。"""
    order = db.get(models.Order, order_id)
    if not order or user.id not in {order.buyer_id, order.seller_id}:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status not in {"completed", "cancelled", "refunded"}:
        raise HTTPException(status_code=409, detail="仅已完成、已取消或退款完成的订单可删除记录")
    if user.id == order.buyer_id:
        order.buyer_deleted = True
    if user.id == order.seller_id:
        order.seller_deleted = True
    db.commit()
    return {"message": "订单记录已删除", "id": order.id}


@router.post("/orders/{order_id}/appeal")
def create_order_appeal(
    order_id: int,
    data: OrderAppealBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """被投诉方对投诉提出申诉，由管理员处理。"""
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    if not order or user.id not in {order.buyer_id, order.seller_id}:
        raise HTTPException(status_code=404, detail="订单不存在")
    complaint = None
    if data.review_id:
        complaint = db.query(models.Review).filter_by(
            id=data.review_id, order_id=order.id, reviewed_user_id=user.id
        ).first()
    if not complaint:
        complaint = (
            db.query(models.Review)
            .filter(
                models.Review.order_id == order.id,
                models.Review.reviewed_user_id == user.id,
                or_(models.Review.is_complaint.is_(True), models.Review.rating <= 2),
            )
            .order_by(models.Review.created_at.desc())
            .first()
        )
    if not complaint:
        raise HTTPException(status_code=409, detail="当前订单没有可申诉的投诉")
    pending = db.query(models.OrderAppeal).filter_by(
        order_id=order.id, appellant_id=user.id, status="pending"
    ).first()
    if pending:
        raise HTTPException(status_code=409, detail="你已有待处理的申诉，请等待客服处理")
    already = db.query(models.OrderAppeal).filter_by(
        order_id=order.id, review_id=complaint.id, appellant_id=user.id, status="approved"
    ).first()
    if already:
        raise HTTPException(status_code=409, detail="该投诉已申诉成功，无需重复提交")
    appeal = models.OrderAppeal(
        order_id=order.id,
        review_id=complaint.id,
        appellant_id=user.id,
        reason=data.reason.strip()[:500],
        status="pending",
    )
    db.add(appeal)
    # 同步一条客服工单，方便管理后台统一查看
    db.add(models.SupportTicket(
        user_id=user.id,
        order_id=order.id,
        category="appeal",
        title=f"订单申诉 {order.order_no}",
        content=f"针对投诉评价#{complaint.id}：{data.reason.strip()[:500]}",
        status="pending",
    ))
    # 通知管理员（is_admin 用户）
    admins = db.query(models.User).filter(models.User.is_admin.is_(True)).all()
    for admin in admins:
        create_notification(
            db,
            recipient_id=admin.id,
            actor_id=user.id,
            notification_type="support",
            title="新的订单申诉待处理",
            content=f"订单 {order.order_no}：{data.reason.strip()[:120]}",
            target_type="order_appeal",
            target_id=order.id,
        )
    create_notification(
        db,
        recipient_id=user.id,
        actor_id=user.id,
        notification_type="support",
        title="申诉已提交",
        content="客服将尽快处理你的订单申诉，请留意通知。",
        target_type="order",
        target_id=order.id,
    )
    db.commit()
    db.refresh(appeal)
    order = db.query(models.Order).options(
        joinedload(models.Order.listing).joinedload(models.Listing.images),
        joinedload(models.Order.service_task),
        joinedload(models.Order.buyer).joinedload(models.User.profile),
        joinedload(models.Order.seller).joinedload(models.User.profile),
    ).filter_by(id=order_id).first()
    return {
        "message": "申诉已提交，等待客服处理",
        "appeal_id": appeal.id,
        "item": full_order_payload(db, order, user.id),
    }


@router.post("/support/tickets", status_code=201)
def create_support_ticket(
    data: SupportTicketBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """用户联系客服，工单进入管理员后台。"""
    order_id = data.order_id
    if order_id:
        order = db.get(models.Order, order_id)
        if not order or user.id not in {order.buyer_id, order.seller_id}:
            raise HTTPException(status_code=404, detail="关联订单不存在")
    ticket = models.SupportTicket(
        user_id=user.id,
        order_id=order_id,
        category=(data.category or "general")[:40],
        title=data.title.strip()[:120],
        content=data.content.strip()[:2000],
        status="pending",
    )
    db.add(ticket)
    db.flush()
    admins = db.query(models.User).filter(models.User.is_admin.is_(True)).all()
    for admin in admins:
        create_notification(
            db,
            recipient_id=admin.id,
            actor_id=user.id,
            notification_type="support",
            title="新的客服工单",
            content=f"{data.title.strip()[:80]}",
            target_type="support_ticket",
            target_id=ticket.id,
        )
    db.commit()
    db.refresh(ticket)
    return {
        "message": "已提交客服，管理员会尽快回复",
        "item": {
            "id": ticket.id,
            "title": ticket.title,
            "content": ticket.content,
            "category": ticket.category,
            "status": ticket.status,
            "order_id": ticket.order_id,
            "created_at": ticket.created_at,
        },
    }


@router.get("/support/tickets")
def list_my_support_tickets(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.SupportTicket)
        .filter_by(user_id=user.id)
        .order_by(models.SupportTicket.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "items": [{
            "id": row.id,
            "title": row.title,
            "content": row.content,
            "category": row.category,
            "status": row.status,
            "order_id": row.order_id,
            "admin_reply": row.admin_reply,
            "created_at": row.created_at,
            "handled_at": row.handled_at,
        } for row in rows]
    }


@router.delete("/conversations/{conversation_id}/messages")
def clear_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conversation = get_conversation_for_user(db, conversation_id, user.id)
    db.query(models.MessageReaction).filter(
        models.MessageReaction.message_id.in_(
            db.query(models.Message.id).filter_by(conversation_id=conversation.id)
        )
    ).delete(synchronize_session=False)
    deleted = db.query(models.Message).filter_by(conversation_id=conversation.id).delete(synchronize_session=False)
    db.commit()
    return {"message": "聊天记录已清空", "deleted": deleted}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    conversation = get_conversation_for_user(db, conversation_id, user.id)
    db.delete(conversation)
    db.commit()
    return {"message": "会话已删除"}


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.query(models.Notification).filter_by(id=notification_id, recipient_id=user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="通知不存在")
    db.delete(row)
    db.commit()
    return {"message": "通知已删除"}


@router.delete("/notifications")
def clear_notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    deleted = db.query(models.Notification).filter_by(recipient_id=user.id).delete(synchronize_session=False)
    db.commit()
    return {"message": "通知已全部清除", "deleted": deleted}


@router.get("/users/{target_user_id}/shop-items")
def get_user_shop_items(
    target_user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = db.query(models.Listing).options(joinedload(models.Listing.images)).filter(
        models.Listing.seller_id == target_user_id,
        models.Listing.status == "available",
    ).order_by(models.Listing.created_at.desc()).limit(40).all()
    return {
        "items": [{
            "id": row.id,
            "type": "game" if row.trade_type == "digital" else "listing",
            "title": row.title,
            "description": (row.description or "")[:120],
            "price": float(row.price),
            "price_label": f"¥{float(row.price):.0f}",
            "image_url": row.images[0].image_url if row.images else None,
            "status": row.status,
        } for row in rows]
    }
