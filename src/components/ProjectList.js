import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Typography,
  Tag,
  message,
  Modal,
  Space,
  Select,
  Avatar,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  UserOutlined,
  SearchOutlined,
  FileTextOutlined,
  HistoryOutlined, // <--- 新增 HistoryOutlined
} from "@ant-design/icons";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import UserAuth from "./UserAuth";
// 引入历史弹窗组件
import VersionHistoryModal from "./VersionHistoryModal";

const { Title, Text } = Typography;
const { Option } = Select;

const ADMIN_EMAIL = "zjunxu1989@gmail.com";

const ProjectList = ({ user, onSelectProject }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(user.uid);

  // --- 历史弹窗状态 ---
  const [historyVisible, setHistoryVisible] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // 1. 加载用户
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin) return;
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const list = [];
        snapshot.forEach((doc) => list.push(doc.data()));
        setAllUsers(list);
      } catch (error) {
        console.error(error);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  // 2. 加载项目
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const projectsRef = collection(db, "projects");
      let q;
      if (isAdmin) {
        q =
          selectedUserId === "ALL"
            ? query(projectsRef)
            : query(projectsRef, where("ownerId", "==", selectedUserId));
      } else {
        q = query(projectsRef, where("ownerId", "==", user.uid));
      }
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) =>
        (a.updatedAt || "0") < (b.updatedAt || "0") ? 1 : -1
      );
      setProjects(list);
    } catch (error) {
      message.error("加载列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, selectedUserId]);

  // Actions
  const handleDelete = async (projectId) => {
    Modal.confirm({
      title: "确认删除?",
      content: "无法恢复，确定删除吗？",
      okType: "danger",
      onOk: async () => {
        try {
          await deleteDoc(doc(db, "projects", projectId));
          message.success("已删除");
          fetchProjects();
        } catch (e) {
          message.error("删除失败");
        }
      },
    });
  };

  const handleCopy = async (project) => {
    try {
      message.loading({ content: "复制中...", key: "copy" });
      const sourceDoc = await getDoc(doc(db, "projects", project.id));
      if (!sourceDoc.exists()) throw new Error("源文件不存在");
      const sourceData = sourceDoc.data();
      const newId = uuidv4();
      const newProjectData = {
        ...sourceData,
        id: newId,
        meta: {
          ...sourceData.meta,
          name: `${sourceData.meta?.name || "未命名"}_副本`,
          id: newId,
        },
        ownerId: user.uid,
        ownerEmail: user.email,
        updatedAt: new Date().toISOString(),
        latestVersion: 1,
      };
      await setDoc(doc(db, "projects", newId), newProjectData);
      message.success({ content: "复制成功", key: "copy" });
      fetchProjects();
    } catch (e) {
      message.error({ content: "复制失败", key: "copy" });
    }
  };

  const handleCreateNew = () => {
    onSelectProject(uuidv4());
  };

  // 打开历史记录
  const showHistory = (e, projectId) => {
    e.stopPropagation();
    setCurrentHistoryId(projectId);
    setHistoryVisible(true);
  };

  const columns = [
    {
      title: "项目名称",
      dataIndex: ["meta", "name"],
      key: "name",
      render: (text, record) => (
        <Space>
          <FileTextOutlined style={{ color: "#1890ff", fontSize: 18 }} />
          <a
            onClick={() => onSelectProject(record.id)}
            style={{ fontWeight: 600, fontSize: 15, color: "#1f1f1f" }}
          >
            {text || "未命名流程"}
          </a>
        </Space>
      ),
    },
    {
      title: "当前版本",
      dataIndex: "latestVersion",
      key: "version",
      width: 100,
      render: (v) => <Tag color="blue">v{v || 1}</Tag>,
    },
    {
      title: "最后修改时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (text) => (text ? new Date(text).toLocaleString() : "-"),
    },
    {
      title: "所属用户",
      key: "owner",
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar
            style={{ backgroundColor: "#87d068" }}
            icon={<UserOutlined />}
            size="small"
          />
          <Text style={{ fontSize: 12 }}>
            {record.ownerEmail?.split("@")[0] || "Unknown"}
          </Text>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 180, // 加宽一点
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onSelectProject(record.id)}
            />
          </Tooltip>
          {/* 新增：历史记录按钮 */}
          <Tooltip title="查看版本日志">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={(e) => showHistory(e, record.id)}
            />
          </Tooltip>
          <Tooltip title="复制副本">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            SOP 配置控制台
          </Title>
          <Text type="secondary">
            {isAdmin ? <Tag color="red">管理员视图</Tag> : "我的工作台"}{" "}
            {user.displayName}
          </Text>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SearchOutlined style={{ color: "#999" }} />
              <Select
                value={selectedUserId}
                onChange={setSelectedUserId}
                style={{ width: 180 }}
                placeholder="筛选用户"
              >
                <Option value={user.uid}>我的项目</Option>
                <Option value="ALL">全部用户的项目</Option>
                {allUsers.map((u) => (
                  <Option key={u.uid} value={u.uid}>
                    {u.displayName || u.email}
                  </Option>
                ))}
              </Select>
            </div>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNew}
          >
            新建流程
          </Button>
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

      <Table
        columns={columns}
        dataSource={projects}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}
      />

      {/* 挂载历史弹窗 */}
      <VersionHistoryModal
        projectId={currentHistoryId}
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </div>
  );
};

export default ProjectList;
