from fastapi import FastAPI, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from app import models
from app.db import SessionLocal, engine
from pydantic import BaseModel # 用于接收前端发送的数据
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.marketplace import router as marketplace_router
from app.admin_panel import router as admin_router



models.Base.metadata.create_all(bind=engine)

def ensure_runtime_schema():
    if engine.dialect.name != "mysql":
        return
    statements = [
        "ALTER TABLE user_profiles MODIFY COLUMN avatar_url LONGTEXT NULL",
        "ALTER TABLE user_profiles ADD COLUMN background_url LONGTEXT NULL",
        "ALTER TABLE user_profiles ADD COLUMN background_theme VARCHAR(40) DEFAULT 'teal'",
        "ALTER TABLE user_profiles ADD COLUMN last_active_at DATETIME NULL",
        "ALTER TABLE users ADD COLUMN is_admin TINYINT(1) DEFAULT 0",
        "ALTER TABLE users ADD COLUMN is_deleted TINYINT(1) DEFAULT 0",
        "ALTER TABLE users ADD COLUMN is_purged TINYINT(1) DEFAULT 0",
        "ALTER TABLE users ADD COLUMN can_comment TINYINT(1) DEFAULT 1",
        "ALTER TABLE users ADD COLUMN can_post TINYINT(1) DEFAULT 1",
        "ALTER TABLE users ADD COLUMN ban_reason VARCHAR(240) NULL",
        "ALTER TABLE marketplace_listings MODIFY COLUMN category_id INT NULL",
        "ALTER TABLE marketplace_listing_images MODIFY COLUMN image_url LONGTEXT NOT NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN image_url LONGTEXT NULL",
        "ALTER TABLE marketplace_service_tasks MODIFY COLUMN image_url LONGTEXT NULL",
        "ALTER TABLE marketplace_wanted_posts ADD COLUMN image_url LONGTEXT NULL",
        "ALTER TABLE marketplace_wanted_posts MODIFY COLUMN image_url LONGTEXT NULL",
        "ALTER TABLE marketplace_community_posts MODIFY COLUMN image_url LONGTEXT NULL",
        "ALTER TABLE marketplace_community_posts ADD COLUMN source_type VARCHAR(30) NULL",
        "ALTER TABLE marketplace_community_posts ADD COLUMN source_id INT NULL",
        "ALTER TABLE marketplace_community_posts ADD COLUMN source_title VARCHAR(160) NULL",
        "ALTER TABLE browse_history MODIFY COLUMN image_url LONGTEXT NULL",
        "ALTER TABLE marketplace_conversations ADD COLUMN context_type VARCHAR(30) NULL",
        "ALTER TABLE marketplace_conversations ADD COLUMN context_id INT NULL",
        "ALTER TABLE marketplace_messages MODIFY COLUMN content LONGTEXT NOT NULL",
        "ALTER TABLE marketplace_messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text'",
        "ALTER TABLE marketplace_messages ADD COLUMN metadata_json LONGTEXT NULL",
        "ALTER TABLE marketplace_messages ADD COLUMN reply_to_id INT NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN buyer_note VARCHAR(240) NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN seller_note VARCHAR(240) NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN cancel_reason VARCHAR(240) NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN paid_at DATETIME NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN shipped_at DATETIME NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN received_at DATETIME NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN cancelled_by_id INT NULL",
        "ALTER TABLE marketplace_orders ADD COLUMN buyer_deleted TINYINT(1) DEFAULT 0",
        "ALTER TABLE marketplace_orders ADD COLUMN seller_deleted TINYINT(1) DEFAULT 0",
        "ALTER TABLE marketplace_orders ADD COLUMN refunded_at DATETIME NULL",
        "ALTER TABLE marketplace_reviews ADD COLUMN is_complaint TINYINT(1) DEFAULT 0",
        "ALTER TABLE marketplace_reports ADD COLUMN admin_note VARCHAR(500) NULL",
        "ALTER TABLE marketplace_reports ADD COLUMN action_taken VARCHAR(40) NULL",
        "ALTER TABLE marketplace_reports ADD COLUMN handled_by INT NULL",
        "ALTER TABLE marketplace_reports ADD COLUMN handled_at DATETIME NULL",
        # Errand navigation / tracking
        "ALTER TABLE marketplace_service_tasks ADD COLUMN pickup_latitude DECIMAL(10,7) NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN pickup_longitude DECIMAL(10,7) NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN delivery_latitude DECIMAL(10,7) NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN delivery_longitude DECIMAL(10,7) NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN desired_delivery_at DATETIME NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN travel_mode VARCHAR(20) DEFAULT 'auto'",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN delivery_phase VARCHAR(20) DEFAULT 'pending'",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN runner_latitude DECIMAL(10,7) NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN runner_longitude DECIMAL(10,7) NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN runner_location_updated_at DATETIME NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN eta_seconds INT NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN distance_meters INT NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN accepted_at DATETIME NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN picked_up_at DATETIME NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN completed_at DATETIME NULL",
        "ALTER TABLE marketplace_service_tasks ADD COLUMN late_complaint_at DATETIME NULL",
        "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0",
        # Performance indexes for chat / inbox (ignore if already exist)
        "CREATE INDEX idx_msg_conv_id ON marketplace_messages (conversation_id, id)",
        "CREATE INDEX idx_msg_conv_unread ON marketplace_messages (conversation_id, is_read, sender_id)",
        "CREATE INDEX idx_msg_reaction_msg ON message_reactions (message_id)",
        "CREATE INDEX idx_conv_updated ON marketplace_conversations (updated_at)",
        "CREATE INDEX idx_notif_recipient_read ON user_notifications (recipient_id, is_read)",
    ]
    with engine.begin() as conn:
        for statement in statements:
            try:
                conn.execute(text(statement))
            except Exception:
                # MySQL raises when a column already exists; keep startup tolerant.
                pass

ensure_runtime_schema()


def ensure_admin_account():
    """Create or refresh the platform admin account used by the console."""
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(
            or_(models.User.username == "admin", models.User.email == "admin@campus.local")
        ).first()
        if not admin:
            admin = models.User(
                username="admin",
                email="admin@campus.local",
                hashed_password="fabulous.Sg123",
                is_active=True,
                is_admin=True,
                can_comment=True,
                can_post=True,
            )
            db.add(admin)
            db.flush()
            db.add(models.UserProfile(
                user_id=admin.id,
                nickname="校园官方",
                school="全国校园",
                signature="校园交易平台官方管理账号",
                background_theme="navy",
            ))
        else:
            admin.username = "admin"
            admin.email = "admin@campus.local"
            admin.hashed_password = "fabulous.Sg123"
            admin.is_active = True
            admin.is_admin = True
            admin.can_comment = True
            admin.can_post = True
            profile = db.query(models.UserProfile).filter_by(user_id=admin.id).first()
            if not profile:
                db.add(models.UserProfile(
                    user_id=admin.id,
                    nickname="校园官方",
                    school="全国校园",
                    signature="校园交易平台官方管理账号",
                    background_theme="navy",
                ))
            else:
                if not profile.nickname:
                    profile.nickname = "校园官方"
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


ensure_admin_account()

app = FastAPI()
app.include_router(marketplace_router)
app.include_router(admin_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，开发环境下可以这样，生产环境建议写死前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic 模型：定义前端传过来的数据格式
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    school: Optional[str] = None
    phone: Optional[str] = None
    verify_code: Optional[str] = None  # 邮箱验证码（推荐）；未配置强制校验时可选

class LoginRequest(BaseModel):
    account: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: str


class EmailSendCodeRequest(BaseModel):
    email: str
    purpose: str = "login"  # login / register / reset


class EmailLoginRequest(BaseModel):
    email: str
    verify_code: str


class EmailRegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    verify_code: str
    school: Optional[str] = None
    phone: Optional[str] = None


class EmailResetPasswordRequest(BaseModel):
    email: str
    verify_code: str
    new_password: str

def public_user(user: models.User, db: Optional[Session] = None):
    payload = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "is_admin": bool(getattr(user, "is_admin", False)),
        "can_comment": bool(getattr(user, "can_comment", True)),
        "can_post": bool(getattr(user, "can_post", True)),
        "ban_reason": getattr(user, "ban_reason", None),
        "created_at": user.created_at,
    }
    if db:
        profile = db.query(models.UserProfile).filter_by(user_id=user.id).first()
        if profile:
            payload["profile"] = {
                "nickname": profile.nickname or user.username,
                "avatar_url": profile.avatar_url,
                "school": profile.school,
                "language": profile.language,
                "background_url": profile.background_url,
                "background_theme": profile.background_theme,
                "signature": profile.signature,
            }
    return payload

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root(db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()
    return {"message": "数据库连接成功！", "user_count": user_count}


@app.post("/login")
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    account = (user_data.account or user_data.username or user_data.email or "").strip()
    if not account:
        raise HTTPException(status_code=400, detail="账号不能为空")

    db_user = db.query(models.User).filter(
        or_(models.User.username == account, models.User.email == account)
    ).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="账号不存在")

    if not db_user.is_active or getattr(db_user, "is_deleted", False) or getattr(db_user, "is_purged", False):
        raise HTTPException(status_code=403, detail="账号已停用，请联系管理员")

    # 当前数据库字段名叫 hashed_password，但原项目实际按明文写入。
    # 如果你的库里存的是 bcrypt/passlib 哈希，需要在这里接入对应 verify 方法。
    if db_user.hashed_password != user_data.password:
        raise HTTPException(status_code=401, detail="密码错误")

    token = f"campus-token-{db_user.id}"
    return {"message": "登录成功", "access_token": token, "token_type": "bearer", "user": public_user(db_user, db)}


@app.post("/auth/email/send-code")
def send_email_verify_code(
    data: EmailSendCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """发送邮箱验证码。purpose: login | register | reset。支持任意邮箱域名。"""
    from app.email_service import create_and_send_code

    purpose = (data.purpose or "login").strip().lower()
    if purpose not in {"login", "register", "reset"}:
        raise HTTPException(status_code=400, detail="purpose 仅支持 login / register / reset")
    client_ip = request.client.host if request.client else None
    return create_and_send_code(db, data.email, purpose, client_ip=client_ip)


@app.post("/login/email")
def login_with_email_code(data: EmailLoginRequest, db: Session = Depends(get_db)):
    """邮箱 + 邮件验证码登录（对齐开放平台 email-verify-code 流程，任意邮箱可用）。"""
    from app.email_service import consume_code, normalize_email

    email = normalize_email(data.email)
    consume_code(db, email, data.verify_code, "login")
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="该邮箱尚未注册，请先注册")
    if not db_user.is_active or getattr(db_user, "is_deleted", False) or getattr(db_user, "is_purged", False):
        raise HTTPException(status_code=403, detail="账号已停用，请联系管理员")
    db_user.email_verified = True
    db.commit()
    db.refresh(db_user)
    token = f"campus-token-{db_user.id}"
    return {
        "message": "邮箱验证码登录成功",
        "access_token": token,
        "token_type": "bearer",
        "user": public_user(db_user, db),
    }


@app.post("/users/email")
def register_with_email_code(data: EmailRegisterRequest, db: Session = Depends(get_db)):
    """邮箱验证码注册：验证邮箱后创建账号，支持 QQ / Gmail / Outlook 等。"""
    from app.email_service import consume_code, normalize_email, validate_email_format

    username = (data.username or "").strip()
    if not username or len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if len(data.password or "") < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    email = validate_email_format(data.email)
    consume_code(db, email, data.verify_code, "register")

    existing_username = db.query(models.User).filter(models.User.username == username).first()
    if existing_username:
        raise HTTPException(status_code=409, detail="用户名已存在")
    existing_email = db.query(models.User).filter(models.User.email == email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="邮箱已注册")

    try:
        db_user = models.User(
            username=username,
            email=email,
            hashed_password=data.password,
            email_verified=True,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        db.add(models.UserProfile(
            user_id=db_user.id,
            nickname=db_user.username,
            school=data.school or "未选择学校",
            signature="在校园里认真交易，也认真生活。",
        ))
        db.commit()
        db.refresh(db_user)
        token = f"campus-token-{db_user.id}"
        return {
            "message": "邮箱注册成功",
            "access_token": token,
            "token_type": "bearer",
            "user": public_user(db_user, db),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"注册失败: {str(e)}")


@app.post("/auth/email/reset-password")
def reset_password_with_email(data: EmailResetPasswordRequest, db: Session = Depends(get_db)):
    """邮箱验证码重置密码。"""
    from app.email_service import consume_code, normalize_email

    if len(data.new_password or "") < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    email = normalize_email(data.email)
    consume_code(db, email, data.verify_code, "reset")
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="该邮箱尚未注册")
    db_user.hashed_password = data.new_password
    db_user.email_verified = True
    db.commit()
    return {"message": "密码已重置，请使用新密码登录"}


# --- 新增：写入数据 (创建用户) ---
@app.post("/users/")
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    from app.email_service import consume_code, normalize_email, validate_email_format
    import os

    existing_username = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(status_code=409, detail="用户名已存在")

    email = validate_email_format(user_data.email)
    existing_email = db.query(models.User).filter(models.User.email == email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="邮箱已注册")

    # 默认要求邮箱验证码；EMAIL_REQUIRE_CODE_ON_REGISTER=0 时可兼容旧客户端
    require_code = (os.getenv("EMAIL_REQUIRE_CODE_ON_REGISTER") or "1").strip().lower() not in {
        "0", "false", "no", "off"
    }
    email_verified = False
    if require_code:
        if not user_data.verify_code:
            raise HTTPException(status_code=400, detail="请先获取并填写邮箱验证码")
        consume_code(db, email, user_data.verify_code, "register")
        email_verified = True
    elif user_data.verify_code:
        consume_code(db, email, user_data.verify_code, "register")
        email_verified = True

    # 1. 创建数据库模型实例
    # 注意：这里 hashed_password 对应数据库字段，暂用明文演示（实际建议加密）
    db_user = models.User(
        username=user_data.username,
        email=email,
        hashed_password=user_data.password,
        email_verified=email_verified,
    )
    
    # 2. 提交到数据库
    try:
        db.add(db_user) # 添加到会话
        db.commit()     # 提交事务
        db.refresh(db_user) # 刷新以获取数据库生成的 ID
        db.add(models.UserProfile(
            user_id=db_user.id,
            nickname=db_user.username,
            school=user_data.school or "未选择学校",
            signature="在校园里认真交易，也认真生活。",
        ))
        db.commit()
        db.refresh(db_user)
        return {"message": "注册成功", "user": public_user(db_user, db)}
    except Exception as e:
        db.rollback() # 出错回滚
        raise HTTPException(status_code=400, detail=f"写入失败: {str(e)}")

# --- 新增：读取数据 (获取所有用户列表) ---
@app.get("/users/")
def get_users(db: Session = Depends(get_db)):
    # 使用 query 查询所有数据
    users = db.query(models.User).all()
    return users
