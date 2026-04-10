# models.py
from sqlalchemy import Boolean, Column, Integer, String, Text, Numeric, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .db import Base

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


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum('available', 'pending', 'sold'), default='available')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 建立与 User 的双向关系
    owner = relationship("User", back_populates="posts")