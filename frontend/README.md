# 校园交易平台前端

React + Vite 前端，包含：

- 校园风登录与注册页面
- 鼠标、账号输入和密码状态驱动的互动角色
- Axios 登录/注册 API 封装
- token 与登录状态持久化
- OGL Ferrofluid WebGL 动态主页
- 桌面端和移动端响应式布局

## 技术说明

实际依赖为 React、Vite、Axios、Lucide React 和 OGL。界面使用原生 CSS 实现。

Tailwind CSS 与 shadcn/ui 只出现在早期参考组件中，当前代码未安装或调用它们，因此没有将其作为运行依赖保留。

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
