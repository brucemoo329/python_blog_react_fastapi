from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from app import models
from app.db import SessionLocal, engine
from pydantic import BaseModel # 用于接收前端发送的数据
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from app.marketplace import router as marketplace_router



models.Base.metadata.create_all(bind=engine)

def ensure_runtime_schema():
    if engine.dialect.name != "mysql":
        return
    statements = [
        "ALTER TABLE user_profiles MODIFY COLUMN avatar_url LONGTEXT NULL",
        "ALTER TABLE user_profiles ADD COLUMN background_url LONGTEXT NULL",
        "ALTER TABLE user_profiles ADD COLUMN background_theme VARCHAR(40) DEFAULT 'teal'",
        "ALTER TABLE user_profiles ADD COLUMN last_active_at DATETIME NULL",
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
    ]
    with engine.begin() as conn:
        for statement in statements:
            try:
                conn.execute(text(statement))
            except Exception:
                # MySQL raises when a column already exists; keep startup tolerant.
                pass

ensure_runtime_schema()

app = FastAPI()
app.include_router(marketplace_router)

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

class LoginRequest(BaseModel):
    account: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

def public_user(user: models.User, db: Optional[Session] = None):
    payload = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
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

    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="账号已停用，请联系管理员")

    # 当前数据库字段名叫 hashed_password，但原项目实际按明文写入。
    # 如果你的库里存的是 bcrypt/passlib 哈希，需要在这里接入对应 verify 方法。
    if db_user.hashed_password != user_data.password:
        raise HTTPException(status_code=401, detail="密码错误")

    token = f"campus-token-{db_user.id}"
    return {"message": "登录成功", "access_token": token, "token_type": "bearer", "user": public_user(db_user, db)}

# --- 新增：写入数据 (创建用户) ---
@app.post("/users/")
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_username = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(status_code=409, detail="用户名已存在")

    existing_email = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="邮箱已注册")

    # 1. 创建数据库模型实例
    # 注意：这里 hashed_password 对应数据库字段，暂用明文演示（实际建议加密）
    db_user = models.User(
        username=user_data.username, 
        email=user_data.email, 
        hashed_password=user_data.password 
    )
    
    # 2. 提交到数据库
    try:
        db.add(db_user) # 添加到会话
        db.commit()     # 提交事务
        db.refresh(db_user) # 刷新以获取数据库生成的 ID
        db.add(models.UserProfile(
            user_id=db_user.id,
            nickname=db_user.username,
            school=user_data.school or "南通理工学院",
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
