import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 导入 App 组件（对应你的 App.js 文件，核心SOP编排逻辑）
import App from "./App";

// 获取 HTML 中的根容器（CodeSandbox 中默认存在 id="root" 的元素）
const rootElement = document.getElementById("root");
// 创建 React 18+ 的根实例
const root = createRoot(rootElement);

// 渲染应用（StrictMode 用于开发环境检测副作用，可保留）
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
