# 校园交易平台

基于 React、FastAPI 与 MySQL 的校园综合交易平台。当前版本包含校园二手、跑腿代取、游戏交易、求购、校园动态、地图任务、收藏与订单基础能力。

## 技术栈

### 前端

- React 19
- Vite 8
- Tailwind CSS 4
- shadcn/ui（JavaScript / JSX）
- React Bits 动效组件（轻量 CSS / Motion / GSAP 组合）
- Motion
- Axios
- Lucide React
- 高德地图 JS API 2.0 实时定位与校园任务地图
- 原生 CSS 角色动画

项目保持 JavaScript/JSX，不使用 TypeScript。shadcn/ui 组件位于 `frontend/src/components/ui`。

### 前端入口与资料引导

- `/`：公开平台介绍页，展示校园二手、跑腿、游戏交易、求购和校园社区。
- `/login`、`/register`：登录与注册；登录页保留互动角色动画。
- 注册成功后会进入四步资料引导，头像、学校、主页背景和个性签名通过 `PUT /marketplace/profile` 保存。
- `/app`：登录后的校园信息流、地图任务、消息、订单和个人主页。

### 后端

- FastAPI
- SQLAlchemy
- MySQL / PyMySQL
- Pydantic

## 本地运行

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173`

本地地图与后端配置放在 `frontend/.env.local`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_AMAP_KEY=你的高德 Web端(JS API) Key
VITE_AMAP_SECURITY_CODE=你的高德安全密钥
```

### 后端

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

默认地址：`http://127.0.0.1:8000`

本地 MySQL 不是默认账号密码时，在项目根目录创建 `.env`：

```env
DATABASE_URL=mysql+pymysql://用户名:URL编码后的密码@127.0.0.1:3306/blog_db?charset=utf8mb4
```

当前接口：

- `POST /login`
- `POST /users/`
- `GET /users/`
- `GET /marketplace/feed`
- `GET /marketplace/map/tasks`
- `GET /marketplace/summary`
- `POST /marketplace/listings`
- `POST /marketplace/tasks`
- `POST /marketplace/tasks/{id}/accept`
- `POST /marketplace/wanted`
- `POST /marketplace/community`
- `POST /marketplace/favorites`
- `POST /marketplace/orders/listing/{id}`
- `GET /marketplace/detail/{type}/{id}`
- `POST /marketplace/comments`
- `DELETE /marketplace/comments/{id}`
- `POST /marketplace/reactions`
- `POST /marketplace/shares`
- `POST /marketplace/relationships/follow/{user_id}`
- `POST /marketplace/relationships/{mute|block}/{user_id}`
- `POST /marketplace/reports`
- `GET /marketplace/notifications`
- `GET /marketplace/users/{user_id}`
- `GET /marketplace/conversations`
- `POST /marketplace/conversations/start`
- `GET|POST /marketplace/conversations/{id}/messages`
- `POST /marketplace/messages/{id}/reactions`

Docker 部署后统一通过 `/api` 访问，例如浏览器请求 `/api/login` 会由 Nginx 转发到 FastAPI 的 `/login`。

后端启动时会通过 SQLAlchemy 自动创建校园交易相关表。首次本地开发可写入演示数据：

```bash
cd backend
.\venv\Scripts\python.exe seed_marketplace.py
```

新增表覆盖商品分类、商品与图片、跑腿任务、游戏交易、求购、校园动态、订单、统一收藏、关注、屏蔽/拉黑、通知、持久化会话、消息、消息表情、评价和举报。

## 检查

```bash
cd frontend
npm run lint
npm run build
```

## Docker 部署

### 第一次部署

服务器需要已安装 Docker、Docker Compose 插件和 Git。

```bash
cd /opt
git clone https://github.com/brucemoo329/python_blog_react_fastapi.git
cd python_blog_react_fastapi
cp .env.example .env
nano .env
docker compose config
docker compose up -d --build
docker compose ps
```

必须在 `.env` 中填写：

- `MYSQL_ROOT_PASSWORD`：MySQL root 密码。
- `MYSQL_PASSWORD`：业务数据库用户密码。
- `DATABASE_URL`：密码部分需与 `MYSQL_PASSWORD` 一致；密码含有 `@`、`#`、`:` 等字符时必须进行 URL 编码。
- `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_CODE`：高德 Web 端 JS API 配置。

不要提交服务器上的 `.env`。

### 后续更新

可以直接执行：

```bash
cd /opt/python_blog_react_fastapi
git pull origin main
docker compose up -d --build
```

也可以使用一键脚本：

```bash
cd /opt/python_blog_react_fastapi
chmod +x deploy.sh
./deploy.sh
```

### 查看日志

```bash
docker compose logs -f
docker logs -f campus_backend
docker logs -f campus_frontend
docker logs -f campus_mysql
```

部署完成后访问：

```text
https://服务器公网IP
```

> **定位权限说明**：Chrome / 手机浏览器只在 **HTTPS** 或 **localhost** 下才会弹出位置权限。  
> 使用 `http://公网IP` 时，浏览器会直接拦截定位，不会出现权限弹窗（本地 `localhost` 正常是预期行为）。

### 启用 HTTPS（自签证书，适合公网 IP）

```bash
cd /opt/python_blog_react_fastapi
bash scripts/gen-ssl-cert.sh 你的公网IP
# 例如: bash scripts/gen-ssl-cert.sh 47.116.9.207
podman compose up -d --build frontend
# 或 docker compose up -d --build frontend
```

首次用手机/Chrome 打开 `https://IP` 时会出现「证书不受信任」提示：点高级 → 继续访问。  
接受后即可弹出定位权限。若已有域名，建议用宝塔 / Let's Encrypt 换成正式证书。

如果 80 端口已被宝塔或系统 Nginx 占用，将 `docker-compose.yml` 中前端端口从：

```yaml
- "80:80"
- "443:443"
```

改为：

```yaml
- "8080:80"
- "8443:443"
```

然后访问 `https://服务器公网IP:8443`。

阿里云安全组至少需要放行 `22`、`80`、`443`（定位功能依赖 443）。

高德控制台请把服务器 **IP / 域名** 加入 Key 的安全域名白名单，否则线上地图可能加载失败。
