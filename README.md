# 校园交易平台

基于 React 与 FastAPI 的校园二手交易平台。当前版本包含登录、注册、登录状态保存、互动角色动画，以及登录后的 Ferrofluid WebGL 首页。

## 技术栈

### 前端

- React 19
- Vite 8
- Axios
- Lucide React
- OGL / React Bits Ferrofluid
- 原生 CSS 响应式布局与动画

> 当前代码没有安装 Tailwind CSS 或 shadcn/ui。早期 UI 参考代码使用了 Tailwind/shadcn 写法，最终实现已适配为项目现有的 React + CSS 结构，避免引入未使用的依赖。

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

如后端地址不是默认值，创建 `frontend/.env.local`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
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

## 检查

```bash
cd frontend
npm run lint
npm run build
```
