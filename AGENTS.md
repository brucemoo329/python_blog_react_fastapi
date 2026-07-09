# AGENTS.md

## 项目概况

本项目是校园交易平台，技术栈如下：

- 前端：React + Vite + JSX
- 后端：FastAPI + SQLAlchemy + Pydantic
- 数据库：MySQL
- 部署：Docker Compose + Nginx
- 默认分支：main

## 重要安全规则

- 不要把真实服务器密码、数据库密码、API 密钥写入仓库文件。
- 不要提交 `.env`，只允许提交 `.env.example`。
- 不要提交服务器私钥、SSH 密钥、数据库备份文件。
- 不要把后端数据库地址写死在 Python 代码里。
- Docker 环境中后端连接 MySQL 时 host 必须使用 `mysql`，不要使用 `127.0.0.1`。
- 本地开发可以使用 `127.0.0.1`，生产 Docker 部署必须使用环境变量 `DATABASE_URL`。

## 环境变量说明

真实环境变量应写在本地或服务器的 `.env` 文件中，不要提交到 GitHub。

`.env` 应包含以下字段：

```env
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=blog_db
MYSQL_USER=campus_user
MYSQL_PASSWORD=
DATABASE_URL=mysql+pymysql://campus_user:你的URL编码密码@mysql:3306/blog_db?charset=utf8mb4
VITE_AMAP_KEY=
VITE_AMAP_SECURITY_CODE=
```

## API 记录规则

以后新增或修改 API 时，同步在本文件记录：

- 接口名称
- 请求方法和路径
- 前端调用文件
- 后端处理文件
- 请求参数
- 返回格式
- 是否需要登录 token
- 涉及的数据表

## 当前 API

### 登录

- 方法和路径：`POST /login`
- 前端代理路径：`POST /api/login`
- 前端调用：`frontend/src/api/auth.js`
- 后端处理：`backend/app/main.py`
- 是否需要 token：否
- 说明：Nginx 将 `/api/login` 转发到后端 `/login`。

### 注册

- 方法和路径：`POST /users/`
- 前端代理路径：`POST /api/users/`
- 前端调用：`frontend/src/api/auth.js`
- 后端处理：`backend/app/main.py`
- 是否需要 token：否

### 后端健康检查

- 方法和路径：`GET /`
- 前端代理路径：`GET /api/`
- 后端处理：`backend/app/main.py`
- 是否需要 token：否

### 个人主页

- 方法和路径：`GET /marketplace/profile`
- 前端代理路径：`GET /api/marketplace/profile`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 是否需要 token：是
- 涉及数据表：`user_profiles`、`user_addresses`、`user_payment_methods`、`browse_history`、`trust_score_events`、`marketplace_favorites`、`marketplace_orders`、`marketplace_reviews`、`marketplace_reports`

### 更新个人资料

- 方法和路径：`PUT /marketplace/profile`
- 前端代理路径：`PUT /api/marketplace/profile`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`nickname`、`avatar_url`、`background_url`、`background_theme`、`school`、`signature`、`language`
- 是否需要 token：是

### 每日签到

- 方法和路径：`POST /marketplace/profile/check-in`
- 前端代理路径：`POST /api/marketplace/profile/check-in`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 说明：每个用户每天只能签到一次，签到后写入 `trust_score_events`，信任分 +2。
- 是否需要 token：是

### 账号与安全

- 方法和路径：`PUT /marketplace/profile/security`
- 前端代理路径：`PUT /api/marketplace/profile/security`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`username`、`current_password`、`new_password`
- 说明：修改用户名会校验唯一性；修改密码需要当前密码。
- 是否需要 token：是

### 地址管理

- 方法和路径：`POST /marketplace/profile/addresses`
- 前端代理路径：`POST /api/marketplace/profile/addresses`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`label`、`receiver_name`、`phone`、`school`、`detail`、`is_default`
- 是否需要 token：是

### 支付与收款方式

- 方法和路径：`POST /marketplace/profile/payment-methods`
- 前端代理路径：`POST /api/marketplace/profile/payment-methods`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`method_type`、`channel`、`display_name`、`account_mask`、`is_default`
- 是否需要 token：是

### 浏览历史

- 方法和路径：`POST /marketplace/profile/history`
- 前端代理路径：`POST /api/marketplace/profile/history`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 说明：按 `user_id + item_type + item_id` 去重，重复浏览只更新时间。
- 是否需要 token：是

### 内容详情

- 方法和路径：`GET /marketplace/detail/{item_type}/{item_id}`
- 前端代理路径：`GET /api/marketplace/detail/{item_type}/{item_id}`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 支持类型：`listing`、`service`、`game`、`wanted`、`community`
- 返回格式：内容主体、发布者头像/学校/信任分、价格、图片、评论树、当前用户态度。
- 是否需要 token：是

### 内容评论

- 方法和路径：`POST /marketplace/comments`
- 前端代理路径：`POST /api/marketplace/comments`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`target_type`、`target_id`、`content`、`parent_id`
- 说明：支持楼中楼回复。
- 是否需要 token：是

### 点赞和不喜欢

- 方法和路径：`POST /marketplace/reactions`
- 前端代理路径：`POST /api/marketplace/reactions`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`target_type`、`target_id`、`reaction_type`
- 说明：同一用户对同一目标只能保留一个态度；再次点击相同态度会取消。
- 是否需要 token：是

### 转发到校园社区

- 方法和路径：`POST /marketplace/shares`
- 前端代理路径：`POST /api/marketplace/shares`
- 前端调用：`frontend/src/api/marketplace.js`
- 后端处理：`backend/app/marketplace.py`
- 请求参数：`source_type`、`source_id`、`comment`
- 说明：生成一条 `marketplace_community_posts` 转发帖，并保存原内容类型和 ID。
- 是否需要 token：是

## 数据库记录规则

以后新增或修改数据表时，同步记录：

- 表名
- 对应 SQLAlchemy model
- 主要字段
- 关联关系
- 由哪些 API 使用

## 当前新增数据表

### user_profiles

- 用途：个人资料、头像、主页背景、学校、个性留言、语言、粉丝/关注数、当前 IP。
- 关联：`user_id -> users.id`
- 使用 API：个人主页、更新个人资料。

### user_addresses

- 用途：地址管理，保存宿舍、教学楼、取货点等校内地址。
- 关联：`user_id -> users.id`
- 使用 API：个人主页、地址管理。

### user_payment_methods

- 用途：支付方式和收款方式，`method_type=payment/payout` 区分。
- 关联：`user_id -> users.id`
- 使用 API：个人主页、支付方式、收款方式。

### browse_history

- 用途：历史浏览，按用户和内容唯一去重。
- 关联：`user_id -> users.id`
- 使用 API：个人主页、浏览历史。

### trust_score_events

- 用途：信任分事件。每天登录、打开主页、交易成功、获得好评、核实违规等都可以记录为加减分事件。
- 关联：`user_id -> users.id`
- 使用 API：登录、个人主页。
- 当前规则：基础分 800；只有手动签到才加每日分；历史旧事件 `daily_login`、`profile_visit` 不再计入信任分。

### content_comments

- 用途：二手市场、跑腿代取、游戏交易、求购、校园社区的统一评论与楼中楼回复。
- 关联：`user_id -> users.id`，`parent_id -> content_comments.id`
- 使用 API：内容详情、内容评论。

### content_reactions

- 用途：统一保存点赞和不喜欢状态。
- 关联：`user_id -> users.id`
- 唯一约束：`user_id + target_type + target_id`
- 使用 API：内容详情、点赞和不喜欢。

### marketplace_listing_images / marketplace_service_tasks.image_url / marketplace_wanted_posts.image_url / marketplace_community_posts.image_url

- 用途：保存发布内容上传的图片。
- 说明：图片字段在 MySQL 中使用 `LONGTEXT`，当前前端会先压缩成 base64 后提交。

### marketplace_community_posts.source_type / source_id / source_title

- 用途：保存转发来源，社区转发帖可以跳回原商品、跑腿、游戏、求购或社区帖子。
- 使用 API：转发到校园社区、内容详情。

## 部署提示

- 本地 Docker Compose 需要在 `docker-compose.yml` 同目录创建 `.env`。
- 服务器部署目录使用服务器本地 `.env`，不要从仓库提交真实配置。
- 如果 80 端口被占用，可以把 `docker-compose.yml` 中前端端口改为 `8080:80`。
