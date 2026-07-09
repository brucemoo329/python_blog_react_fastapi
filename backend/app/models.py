# models.py
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import LONGTEXT
from .db import Base

LongText = Text().with_variant(LONGTEXT, "mysql")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 建立与 Post 的双向关系
    posts = relationship("Post", back_populates="owner")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="available", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 建立与 User 的双向关系
    owner = relationship("User", back_populates="posts")


class Category(Base):
    __tablename__ = "marketplace_categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    slug = Column(String(50), nullable=False, unique=True, index=True)
    icon = Column(String(40), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class Listing(Base):
    __tablename__ = "marketplace_listings"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("marketplace_categories.id"), nullable=True, index=True)
    title = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    original_price = Column(Numeric(10, 2), nullable=True)
    condition = Column(String(20), default="good")
    trade_type = Column(String(20), default="physical", index=True)
    status = Column(String(20), default="available", index=True)
    campus = Column(String(100), nullable=True)
    location_name = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    seller = relationship("User")
    category = relationship("Category")
    images = relationship(
        "ListingImage",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingImage.sort_order",
    )


class ListingImage(Base):
    __tablename__ = "marketplace_listing_images"

    id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url = Column(LongText, nullable=False)
    sort_order = Column(Integer, default=0)

    listing = relationship("Listing", back_populates="images")


class ServiceTask(Base):
    __tablename__ = "marketplace_service_tasks"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    runner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    task_type = Column(String(30), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    reward = Column(Numeric(10, 2), nullable=False)
    pickup_location = Column(String(120), nullable=True)
    delivery_location = Column(String(120), nullable=False)
    image_url = Column(LongText, nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="open", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    requester = relationship("User", foreign_keys=[requester_id])
    runner = relationship("User", foreign_keys=[runner_id])


class GameTrade(Base):
    __tablename__ = "marketplace_game_trades"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    game_name = Column(String(80), nullable=False, index=True)
    server_name = Column(String(80), nullable=True)
    item_type = Column(String(40), nullable=False)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="available", index=True)
    cover_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    seller = relationship("User")


class WantedPost(Base):
    __tablename__ = "marketplace_wanted_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False)
    budget_min = Column(Numeric(10, 2), nullable=True)
    budget_max = Column(Numeric(10, 2), nullable=True)
    location_name = Column(String(100), nullable=True)
    image_url = Column(LongText, nullable=True)
    status = Column(String(20), default="open", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")


class CommunityPost(Base):
    __tablename__ = "marketplace_community_posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(120), nullable=True)
    content = Column(Text, nullable=False)
    topic = Column(String(50), default="校园生活", index=True)
    image_url = Column(LongText, nullable=True)
    source_type = Column(String(30), nullable=True, index=True)
    source_id = Column(Integer, nullable=True, index=True)
    source_title = Column(String(160), nullable=True)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    author = relationship("User")


class Order(Base):
    __tablename__ = "marketplace_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(40), nullable=False, unique=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id = Column(Integer, ForeignKey("marketplace_listings.id", ondelete="SET NULL"), nullable=True)
    service_task_id = Column(Integer, ForeignKey("marketplace_service_tasks.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(30), default="pending_confirm", index=True)
    delivery_method = Column(String(30), default="campus_meet")
    meeting_location = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    listing = relationship("Listing")
    service_task = relationship("ServiceTask")


class Favorite(Base):
    __tablename__ = "marketplace_favorites"
    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_favorite_user_listing"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id = Column(Integer, ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    __tablename__ = "marketplace_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_b_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id = Column(Integer, ForeignKey("marketplace_listings.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "marketplace_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("marketplace_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


class Review(Base):
    __tablename__ = "marketplace_reviews"
    __table_args__ = (UniqueConstraint("order_id", "reviewer_id", name="uq_review_order_user"),)

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("marketplace_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewed_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    __tablename__ = "marketplace_reports"

    id = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(30), nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    reason = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    nickname = Column(String(80), nullable=True)
    avatar_url = Column(LongText, nullable=True)
    background_url = Column(LongText, nullable=True)
    background_theme = Column(String(40), default="teal")
    school = Column(String(120), default="南通理工学院", index=True)
    signature = Column(String(180), nullable=True)
    current_ip = Column(String(80), nullable=True)
    language = Column(String(20), default="zh-CN")
    follower_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="profile")


class UserAddress(Base):
    __tablename__ = "user_addresses"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(40), default="宿舍")
    receiver_name = Column(String(80), nullable=False)
    phone = Column(String(40), nullable=True)
    school = Column(String(120), nullable=True)
    detail = Column(String(240), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")


class UserPaymentMethod(Base):
    __tablename__ = "user_payment_methods"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    method_type = Column(String(20), nullable=False, index=True)
    channel = Column(String(40), nullable=False)
    display_name = Column(String(120), nullable=False)
    account_mask = Column(String(80), nullable=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class BrowseHistory(Base):
    __tablename__ = "browse_history"
    __table_args__ = (UniqueConstraint("user_id", "item_type", "item_id", name="uq_history_user_item"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(String(30), nullable=False, index=True)
    item_id = Column(Integer, nullable=False, index=True)
    title = Column(String(160), nullable=False)
    image_url = Column(LongText, nullable=True)
    price_label = Column(String(60), nullable=True)
    viewed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

    user = relationship("User")


class TrustScoreEvent(Base):
    __tablename__ = "trust_score_events"
    __table_args__ = (UniqueConstraint("user_id", "event_type", "occurred_on", name="uq_trust_daily_event"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(40), nullable=False, index=True)
    points_delta = Column(Integer, nullable=False)
    reason = Column(String(160), nullable=False)
    related_type = Column(String(40), nullable=True)
    related_id = Column(Integer, nullable=True)
    occurred_on = Column(Date, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")


class ContentComment(Base):
    __tablename__ = "content_comments"

    id = Column(Integer, primary_key=True)
    target_type = Column(String(30), nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("content_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    like_count = Column(Integer, default=0)
    dislike_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")
    parent = relationship(
        "ContentComment",
        remote_side=[id],
        backref=backref("replies", cascade="all, delete-orphan", order_by="ContentComment.created_at"),
    )


class ContentReaction(Base):
    __tablename__ = "content_reactions"
    __table_args__ = (UniqueConstraint("user_id", "target_type", "target_id", name="uq_reaction_user_target"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(30), nullable=False, index=True)
    target_id = Column(Integer, nullable=False, index=True)
    reaction_type = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")
