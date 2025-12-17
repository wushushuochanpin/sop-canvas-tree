import React, { useState, useEffect } from "react";
import { Layout, Typography, Spin } from "antd";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

// 引入我们的三个核心组件
import UserAuth from "./components/UserAuth";
import ProjectList from "./components/ProjectList";
import SOPEditor from "./components/SOPEditor";
import FloatingWatermark from "./components/FloatingWatermark";

const { Content } = Layout;
const { Title } = Typography;

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState(null);

  // 1. 全局监听登录状态
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      // 如果登出了，自动回到首页
      if (!currentUser) {
        setCurrentProjectId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 页面路由渲染逻辑
  const renderContent = () => {
    // A. 正在检查登录状态...
    if (authLoading) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <Spin size="large" tip="正在连接 SOP 云端..." />
        </div>
      );
    }

    // B. 未登录 -> 显示登录页
    if (!user) {
      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "#f0f2f5",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "60px 80px",
              borderRadius: 16,
              boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 24 }}>🚀</div>
            <Title level={2} style={{ marginBottom: 8 }}>
              SOP 流程编排系统
            </Title>
            <div style={{ color: "#888", marginBottom: 40 }}>
              Design by zhangjunxu
            </div>

            {/* 这里的 UserAuth 在未登录时会显示 "Google 登录" 按钮 */}
            <div style={{ transform: "scale(1.2)" }}>
              <UserAuth />
            </div>
          </div>
          <FloatingWatermark />
        </div>
      );
    }

    // C. 已登录，但没有选择项目 -> 显示项目列表
    if (!currentProjectId) {
      return (
        <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
          <ProjectList
            user={user}
            onSelectProject={(id) => setCurrentProjectId(id)}
          />
          <FloatingWatermark />
        </div>
      );
    }

    // D. 已登录，且选择了项目 -> 显示编辑器
    return (
      <SOPEditor
        user={user}
        projectId={currentProjectId}
        onBack={() => setCurrentProjectId(null)} // 返回列表
      />
    );
  };

  return <Layout style={{ minHeight: "100vh" }}>{renderContent()}</Layout>;
};

export default App;
