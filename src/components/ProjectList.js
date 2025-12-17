import React, { useEffect, useState } from "react";
import {
  List,
  Card,
  Button,
  Typography,
  Tag,
  Space,
  message,
  Modal,
  Spin,
} from "antd";
import {
  PlusOutlined,
  FileTextOutlined,
  DeleteOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import UserAuth from "./UserAuth"; // 引入头部用户信息组件

const { Title, Text } = Typography;

// --- 管理员账号配置 ---
const ADMIN_EMAIL = "zjunxu1989@gmail.com";

const ProjectList = ({ user, onSelectProject }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // 判断是否是管理员
  const isAdmin = user?.email === ADMIN_EMAIL;

  // 1. 加载项目列表
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const projectsRef = collection(db, "projects");
      let q;

      if (isAdmin) {
        // 管理员：看所有，按时间倒序
        // 注意：如果报错 "requires an index"，去 Firebase 控制台点一下生成的链接创建索引即可
        // 这里先做简单的客户端排序，避免索引报错
        q = query(projectsRef);
      } else {
        // 普通用户：只看自己的
        q = query(projectsRef, where("ownerId", "==", user.uid));
      }

      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // 客户端排序 (按更新时间倒序)
      list.sort((a, b) => {
        const t1 = a.updatedAt || "0";
        const t2 = b.updatedAt || "0";
        return t1 < t2 ? 1 : -1;
      });

      setProjects(list);
    } catch (error) {
      console.error("加载失败", error);
      message.error("加载列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  // 2. 删除项目
  const handleDelete = async (e, projectId) => {
    e.stopPropagation(); // 阻止冒泡
    Modal.confirm({
      title: "确认删除?",
      content: "删除后无法恢复，确定要删除这个流程吗？",
      okType: "danger",
      onOk: async () => {
        try {
          await deleteDoc(doc(db, "projects", projectId));
          message.success("已删除");
          fetchProjects(); // 刷新列表
        } catch (error) {
          message.error("删除失败");
        }
      },
    });
  };

  // 3. 新建项目
  const handleCreateNew = () => {
    const newId = uuidv4();
    // 直接进入编辑器，由编辑器负责初始化数据
    onSelectProject(newId);
  };

  return (
    <div style={{ padding: "24px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* 顶部栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            SOP 配置控制台
          </Title>
          <Text type="secondary">
            {isAdmin ? <Tag color="red">管理员视图</Tag> : "我的工作台"}
            {user.displayName}
          </Text>
        </div>

        {/* 这里复用 UserAuth，但只作为展示和退出用 */}
        {/* 实际上 App.js 会处理登录状态，这里 UserAuth 只要能显示头像就行 */}
        {/* 为了简单，我们直接显示一个“新建”按钮，退出在头像里 */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNew}
            size="large"
          >
            新建流程
          </Button>
          {/* 这里的 UserAuth 会通过 onUserChange 传给 App.js，让 App.js 处理登出逻辑 */}
          {/* 但因为 UserAuth 内部是用 firebase auth 监听的，App.js 也会自动感知 */}
          <div
            style={{
              border: "1px solid #eee",
              padding: "4px 8px",
              borderRadius: 6,
              background: "#fff",
            }}
          >
            <UserAuth />
          </div>
        </div>
      </div>

      {/* 列表区域 */}
      {loading ? (
        <div style={{ textAlign: "center", marginTop: 100 }}>
          <Spin size="large" tip="加载数据中..." />
        </div>
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
          dataSource={projects}
          renderItem={(item) => (
            <List.Item>
              <Card
                hoverable
                onClick={() => onSelectProject(item.id)}
                actions={[
                  <span key="time" style={{ fontSize: 12, color: "#999" }}>
                    <ClockCircleOutlined />{" "}
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>,
                  <DeleteOutlined
                    key="delete"
                    style={{ color: "red" }}
                    onClick={(e) => handleDelete(e, item.id)}
                  />,
                ]}
              >
                <Card.Meta
                  avatar={
                    <FileTextOutlined
                      style={{ fontSize: 24, color: "#1890ff" }}
                    />
                  }
                  title={item.meta?.name || "未命名流程"}
                  description={
                    <div style={{ fontSize: 12, color: "#666" }}>
                      <div style={{ marginBottom: 4 }}>
                        ID: {item.id.slice(0, 6)}...
                      </div>
                      {/* 如果是管理员，显示一下是谁创建的 */}
                      {isAdmin && item.ownerEmail && (
                        <Tag color="orange" style={{ margin: 0 }}>
                          {item.ownerEmail.split("@")[0]}
                        </Tag>
                      )}
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      )}

      {!loading && projects.length === 0 && (
        <div style={{ textAlign: "center", marginTop: 100, color: "#999" }}>
          <FileTextOutlined
            style={{ fontSize: 64, marginBottom: 16, color: "#eee" }}
          />
          <p>暂无项目，点击右上角新建</p>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
