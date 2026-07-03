# 校园交易平台

基于 React、FastAPI 与 MySQL 的校园综合交易平台。当前版本包含校园二手、跑腿代取、游戏交易、求购、校园动态、地图任务、收藏与订单基础能力。

## 技术栈

### 前端

- React 19
- Vite 8
- Tailwind CSS 4
- shadcn/ui（JavaScript / JSX）
- Axios
- Lucide React
- 高德地图 JS API 2.0 实时定位与校园任务地图
- 原生 CSS 角色动画

项目保持 JavaScript/JSX，不使用 TypeScript。shadcn/ui 组件位于 `frontend/src/components/ui`。

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

当前接口：

- `POST /login`
- `POST /users/`
- `GET /users/`
- `GET /api/marketplace/feed`
- `GET /api/marketplace/map/tasks`
- `GET /api/marketplace/summary`
- `POST /api/marketplace/listings`
- `POST /api/marketplace/tasks`
- `POST /api/marketplace/tasks/{id}/accept`
- `POST /api/marketplace/wanted`
- `POST /api/marketplace/community`
- `POST /api/marketplace/favorites`
- `POST /api/marketplace/orders/listing/{id}`

后端启动时会通过 SQLAlchemy 自动创建校园交易相关表。首次本地开发可写入演示数据：

```bash
cd backend
.\venv\Scripts\python.exe seed_marketplace.py
```

新增表覆盖商品分类、商品与图片、跑腿任务、游戏交易、求购、校园动态、订单、收藏、会话、消息、评价和举报。

## 检查

```bash
cd frontend
npm run lint
npm run build
```
