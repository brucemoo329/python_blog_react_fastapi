from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app import models
from app.db import SessionLocal


router = APIRouter(prefix="/marketplace", tags=["campus-marketplace"])


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


class CommunityPostCreate(BaseModel):
    content: str = Field(min_length=2, max_length=3000)
    title: Optional[str] = Field(default=None, max_length=120)
    topic: str = Field(default="校园生活", max_length=50)
    image_url: Optional[str] = None


class WantedPostCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=2, max_length=2000)
    budget_min: Optional[Decimal] = Field(default=None, ge=0)
    budget_max: Optional[Decimal] = Field(default=None, ge=0)
    location_name: Optional[str] = None


class FavoriteCreate(BaseModel):
    listing_id: int


def user_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
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
        "created_at": listing.created_at,
    }


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
    listing = models.Listing(
        seller_id=user.id,
        category_id=data.category_id,
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
    return {"message": "商品发布成功", "id": listing.id}


@router.post("/tasks", status_code=201)
def create_task(
    data: ServiceTaskCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    task = models.ServiceTask(requester_id=user.id, **data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "任务发布成功", "id": task.id}


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
    return {"message": "动态发布成功", "id": post.id}


@router.post("/wanted", status_code=201)
def create_wanted_post(
    data: WantedPostCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    post = models.WantedPost(user_id=user.id, **data.model_dump())
    db.add(post)
    db.commit()
    return {"message": "求购发布成功", "id": post.id}


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


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
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
    }
