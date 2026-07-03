# 校园交易平台前端

React + Vite 前端，包含：

- 校园风登录与注册页面
- 鼠标、账号输入和密码状态驱动的互动角色
- Axios 登录/注册 API 封装
- token 与登录状态持久化
- Tailwind CSS 4 工具类
- shadcn/ui JavaScript 组件
- 校园脉动三栏信息流首页
- 高德地图 JS API 2.0 校园雷达与实时定位
- Tailwind CSS 4 与 shadcn/ui 交互组件
- 桌面端和移动端响应式布局

## 技术说明

项目保持 React JSX，不使用 TypeScript。登录页表单使用 Tailwind CSS 与 shadcn/ui，角色动画继续使用独立 CSS。

shadcn 配置：

- `components.json`
- `src/components/ui`
- `src/lib/utils.js`
- `@/*` 路径别名

已安装组件包括 Button、Input、Label、Checkbox、Card、Dialog、Field、Input Group 和 Spinner。

## 启动

```bash
npm install
npm run dev
```

配置后端地址：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 构建检查

```bash
npm run lint
npm run build
```
