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

数据库密码等敏感信息写在本地或服务器的 `.env` 中，不要提交到 GitHub。  
**高德地图 Key（按你的要求记录在本文件，便于协作）：**

| 用途 | Key / 值 | 说明 |
|------|----------|------|
| Web 端 JS API Key | `867422fb5b0f48f834d8baaf639f7f3f` | 前端 `VITE_AMAP_KEY`，地图展示、定位、地理编码、路径规划插件 |
| JS API 安全密钥 | `ebc94e6142ced0c3f23716f816fdd9d9` | 前端 `VITE_AMAP_SECURITY_CODE`，`window._AMapSecurityConfig` |
| 导航 / Web 服务 Key | `4b55da0f36567be611f6b7add4520610` | 高德导航与路径服务；当前路径规划走 JS API 插件（Driving/Walking/Riding），此 Key 用于控制台开通导航相关能力与后续 REST 扩展 |

`.env` 应包含：

```env
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=blog_db
MYSQL_USER=campus_user
MYSQL_PASSWORD=
DATABASE_URL=mysql+pymysql://campus_user:你的URL编码密码@mysql:3306/blog_db?charset=utf8mb4
VITE_AMAP_KEY=867422fb5b0f48f834d8baaf639f7f3f
VITE_AMAP_SECURITY_CODE=ebc94e6142ced0c3f23716f816fdd9d9
VITE_AMAP_NAV_KEY=4b55da0f36567be611f6b7add4520610
```

高德控制台需把服务器域名/IP（含 `https://公网IP`）加入 Key 白名单。定位需 **HTTPS**（或 localhost）。

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

### 删除自己的评论

- 方法和路径：`DELETE /marketplace/comments/{comment_id}`
- 前端代理路径：`DELETE /api/marketplace/comments/{comment_id}`
- 说明：仅评论作者可删除；楼中楼回复和对应表态会一并清理。
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

### 收藏、关注与用户治理

- 收藏：`POST /marketplace/favorites`，支持 `listing`、`service`、`game`、`wanted`、`community`。
- 关注：`POST /marketplace/relationships/follow/{user_id}`，再次调用取消关注。
- 屏蔽或拉黑：`POST /marketplace/relationships/{action}/{user_id}`，`action` 为 `mute` 或 `block`。
- 举报：`POST /marketplace/reports`。
- 用户主页：`GET /marketplace/users/{user_id}`。
- 以上接口均需要 token。

### 通知与私信

- 通知列表：`GET /marketplace/notifications`。
- 全部已读：`POST /marketplace/notifications/read-all`。
- 单条已读：`POST /marketplace/notifications/{notification_id}/read`。
- 删除单条通知：`DELETE /marketplace/notifications/{notification_id}`。
- 一键清除通知：`DELETE /marketplace/notifications`。
- 发起会话：`POST /marketplace/conversations/start`。
- 会话列表：`GET /marketplace/conversations`。
- 消息列表：`GET /marketplace/conversations/{conversation_id}/messages`。
- 发送消息：`POST /marketplace/conversations/{conversation_id}/messages`。
- 消息表情：`POST /marketplace/messages/{message_id}/reactions`。
- 清空会话消息：`DELETE /marketplace/conversations/{conversation_id}/messages`。
- 删除会话：`DELETE /marketplace/conversations/{conversation_id}`。
- 对方在售商品：`GET /marketplace/users/{user_id}/shop-items`。
- 消息支持文本、图片、位置、转账、商品卡片、订单卡片；记录持久化到 MySQL。
- 以上接口均需要 token。

### 订单

- 创建商品订单：`POST /marketplace/orders/listing/{listing_id}`
- 我的订单：`GET /marketplace/orders`（过滤各自 `buyer_deleted` / `seller_deleted` 软删除）
- 订单详情：`GET /marketplace/orders/{order_id}`
- 付款：`POST /marketplace/orders/{order_id}/pay`（自动私信卖家）
- 发货：`POST /marketplace/orders/{order_id}/ship`（自动私信买家）
- 确认收货：`POST /marketplace/orders/{order_id}/receive`
- 取消订单：`POST /marketplace/orders/{order_id}/cancel`（可填原因；跑腿单进行中也可双方取消）
- 评价/投诉：`POST /marketplace/orders/{order_id}/review`（`rating`、`content`、`is_complaint`；对象始终是对方）
  - 跑腿：发布者（buyer）评价/投诉跑手（seller）；跑手评价/投诉发布者
  - 好评 ≥4 星对方信任分 +8；投诉/差评对方 -20
- 不投诉：`POST /marketplace/orders/{order_id}/skip-review`
- 删除记录：`POST /marketplace/orders/{order_id}/delete-record`（仅已完成/已取消，软删除对自己隐藏）
- 订单申诉：`POST /marketplace/orders/{order_id}/appeal`（被投诉方可申诉，同步客服工单与管理员通知）
- 状态：`pending_payment` / `pending_ship` / `shipped` / `completed` / `cancelled`
- 前端：`OrdersCenter.jsx`、`CheckoutPlaceholder.jsx`；手机底栏含「我的订单」
- 后端：`backend/app/marketplace.py`
- 需要 token

### 客服工单

- 提交工单：`POST /marketplace/support/tickets`（`title`、`content`、`category`、可选 `order_id`）
- 我的工单：`GET /marketplace/support/tickets`
- 前端：`ProfileCenter.jsx` 联系客服
- 后端：`marketplace.py`；管理员处理见管理后台
- 需要 token

### 管理后台（仅 is_admin）

- 总览：`GET /marketplace/admin/overview`（含 `pending_appeals`、`pending_tickets`）
- 内容列表/改/删：`GET|PUT|DELETE /marketplace/admin/contents...`
- 举报列表/处理：`GET /marketplace/admin/reports`、`POST /marketplace/admin/reports/{id}/handle`
- 订单申诉：`GET /marketplace/admin/appeals`、`POST /marketplace/admin/appeals/{id}/handle`（`approved` 恢复信任分 / `rejected` 驳回）
- 客服工单：`GET /marketplace/admin/support-tickets`、`POST /marketplace/admin/support-tickets/{id}/handle`
- 用户与处罚：`GET /marketplace/admin/users`、`PUT /marketplace/admin/users/{id}/penalties`
- 官方通知：`POST /marketplace/admin/notices`
- 前端：`AdminPanel.jsx`
- 后端：`backend/app/admin_panel.py`
- 启动时自动确保管理员账号 `admin` 存在

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

### content_favorites

- 用途：统一保存商品、跑腿、游戏、求购和社区帖收藏。
- 唯一约束：`user_id + target_type + target_id`
- 使用 API：收藏切换、个人主页收藏列表、内容详情。

### user_follows / user_moderations

- 用途：分别保存关注关系，以及用户的屏蔽、拉黑关系。
- 唯一约束：关注双方唯一；治理记录按用户、目标用户和动作唯一。
- 使用 API：关注、回关、屏蔽、拉黑、粉丝与关注列表、信息流过滤。

### user_notifications

- 用途：保存关注、评论、举报、接单、私信等通知和已读状态。
- 使用 API：顶部通知窗口、未读数量、接单双方提醒。

### marketplace_conversations / marketplace_messages / message_reactions

- 用途：持久化私信会话、文本或富媒体消息、引用消息和 emoji 表态。
- 关联：会话关联双方用户；消息关联会话、发送者和可选引用消息。
- 使用 API：帖子快捷私信、完整消息中心、消息轮询与表态、清空/删除会话、商品/订单卡片。

### users 管理字段

- 新增：`is_admin`、`can_comment`、`can_post`、`ban_reason`
- 使用 API：登录返回、管理后台处罚、发帖/评论权限校验

### marketplace_orders 扩展

- 新增：`paid_at`、`shipped_at`、`received_at`、`buyer_note`、`seller_note`、`cancel_reason`、`cancelled_by_id`、`buyer_deleted`、`seller_deleted`、`service_task_id`
- 默认状态：`pending_payment`
- 跑腿订单：`buyer_id`=发布者，`seller_id`=跑手

### marketplace_reviews 扩展

- 新增：`is_complaint`；评价对象为 `reviewed_user_id`（始终是交易对方）

### marketplace_order_appeals

- 用途：被投诉方对订单投诉提出申诉，管理员同意/驳回
- 字段：`order_id`、`review_id`、`appellant_id`、`reason`、`status`、`admin_note`、`handled_by`、`handled_at`
- 使用 API：订单申诉、管理后台申诉处理

### marketplace_support_tickets

- 用途：用户联系客服工单，对接管理员账户
- 字段：`user_id`、`order_id`、`category`、`title`、`content`、`status`、`admin_reply`、`handled_by`、`handled_at`
- 使用 API：个人中心联系客服、管理后台客服工单

### marketplace_listing_images / marketplace_service_tasks.image_url / marketplace_wanted_posts.image_url / marketplace_community_posts.image_url

- 用途：保存发布内容上传的图片。
- 说明：图片字段在 MySQL 中使用 `LONGTEXT`，当前前端会先压缩成 base64 后提交。

### marketplace_community_posts.source_type / source_id / source_title

- 用途：保存转发来源，社区转发帖可以跳回原商品、跑腿、游戏、求购或社区帖子。
- 使用 API：转发到校园社区、内容详情。

### marketplace_service_tasks 跑腿导航扩展

- 新增字段：`pickup_latitude/longitude`、`delivery_latitude/longitude`、`desired_delivery_at`、`travel_mode`、`delivery_phase`、`runner_latitude/longitude`、`runner_location_updated_at`、`eta_seconds`、`distance_meters`、`accepted_at`、`picked_up_at`、`completed_at`、`late_complaint_at`
- `delivery_phase`：`pending` → `to_pickup` → `delivering` → `delivered`
- `travel_mode`：`walk` / `ride` / `drive` / `auto`（自动按距离估算）
- 超时投诉：超过期望送达时间 20 分钟后，发布者可投诉，跑手信任分 -20

### 跑腿导航 API

- `POST /marketplace/tasks`：发布跑腿（取货地址、送达门牌、期望时间、坐标）
- `POST /marketplace/tasks/{id}/accept`：接单并上报跑手位置/出行方式/ETA
- `GET /marketplace/tasks/active`：我的进行中跑腿（发布者或跑手）
- `GET /marketplace/tasks/{id}/tracking`：实时配送进度
- `POST /marketplace/tasks/{id}/location`：跑手更新位置与 ETA
- `POST /marketplace/tasks/{id}/picked-up`：确认取货，切换为配送段
- `POST /marketplace/tasks/{id}/complete`：确认送达
- `PATCH /marketplace/tasks/{id}/desired-time`：发布者修改期望送达时间
- `POST /marketplace/tasks/{id}/late-complaint`：超时投诉 -20 信任分
- `GET /marketplace/map/tasks`：校园雷达 **待接任务** 点位
- 前端：`PublishDialog.jsx`、`CampusRadar.jsx`、`ErrandTrackingMap.jsx`、`ContentDetail.jsx`、`lib/amap.js`
- 后端：`marketplace.py`、`models.py`
- 均需 token

## 部署提示

- 本地 Docker Compose 需要在 `docker-compose.yml` 同目录创建 `.env`。
- 服务器部署目录使用服务器本地 `.env`，不要从仓库提交真实配置。
- 如果 80 端口被占用，可以把 `docker-compose.yml` 中前端端口改为 `8080:80`。
