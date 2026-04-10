from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models
from app.db import SessionLocal, engine
from pydantic import BaseModel # 用于接收前端发送的数据
from fastapi.middleware.cors import CORSMiddleware



models.Base.metadata.create_all(bind=engine)

app = FastAPI()

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


# 这只是演示逻辑，实际项目中需要比对 hashed_password
@app.post("/login")
def login(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if not db_user or db_user.hashed_password != user_data.password:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"message": "登录成功", "user": db_user}

# --- 新增：写入数据 (创建用户) ---
@app.post("/users/")
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
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
        return {"message": "写入成功", "user": db_user}
    except Exception as e:
        db.rollback() # 出错回滚
        raise HTTPException(status_code=400, detail=f"写入失败: {str(e)}")

# --- 新增：读取数据 (获取所有用户列表) ---
@app.get("/users/")
def get_users(db: Session = Depends(get_db)):
    # 使用 query 查询所有数据
    users = db.query(models.User).all()
    return users