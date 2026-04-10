from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# MySQL 连接配置
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:123456@127.0.0.1:3306/blog_db"
# 修改说明:
# - root: MySQL用户名（根据你的实际用户名修改）
# - 123456: MySQL密码（根据你的实际密码修改）
# - localhost: 数据库主机（默认本地）
# - 3306: MySQL端口（默认3306）
# - blog_db: 数据库名称

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"charset": "utf8mb4"},
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
