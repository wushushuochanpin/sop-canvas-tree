import React, { useEffect, useState } from "react";
import { Button, Avatar, Dropdown, message, Spin } from "antd";
import {
  GoogleOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, googleProvider, db } from "../firebase"; // 注意这里的路径是 ../firebase

const UserAuth = ({ onUserChange }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 监听登录状态
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (onUserChange) {
        onUserChange(currentUser);
      }
    });
    return () => unsubscribe();
  }, [onUserChange]);

  // 2. 登录逻辑
  const handleLogin = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          role: "user",
        });
        message.success(`欢迎注册, ${user.displayName}!`);
      } else {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
        message.success(`欢迎回来, ${user.displayName}`);
      }
    } catch (error) {
      console.error("登录失败", error);
      message.error("登录失败: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. 登出逻辑
  const handleLogout = async () => {
    try {
      await signOut(auth);
      message.info("已退出登录");
    } catch (error) {
      message.error("退出失败");
    }
  };

  const items = [
    {
      key: "1",
      label: (
        <div style={{ padding: "4px 0" }}>
          <div style={{ fontWeight: "bold" }}>{user?.displayName}</div>
          <div style={{ fontSize: 12, color: "#999" }}>{user?.email}</div>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "2",
      danger: true,
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: handleLogout,
    },
  ];

  if (loading) return <Spin size="small" />;

  if (user) {
    return (
      <Dropdown menu={{ items }} placement="bottomRight" arrow>
        <div
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <Avatar src={user.photoURL} icon={<UserOutlined />} />
        </div>
      </Dropdown>
    );
  }

  return (
    <Button
      type="primary"
      icon={<GoogleOutlined />}
      onClick={handleLogin}
      style={{ background: "#4285F4", borderColor: "#4285F4" }}
    >
      Google 登录
    </Button>
  );
};

export default UserAuth;
