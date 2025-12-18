import React, { useEffect, useState } from "react";
import {
  Modal,
  Timeline,
  Tag,
  Typography,
  Spin,
  Empty,
  Button,
  Space,
} from "antd";
import {
  UserOutlined,
  FileTextOutlined,
  RocketOutlined,
  EditOutlined,
  DownOutlined,
  UpOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const { Text } = Typography;

const VersionHistoryModal = ({ projectId, visible, onClose }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedKeys, setExpandedKeys] = useState({});

  useEffect(() => {
    if (visible && projectId) {
      fetchVersions();
      setExpandedKeys({});
    }
  }, [visible, projectId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const versionsRef = collection(db, "projects", projectId, "versions");
      const q = query(versionsRef, orderBy("version", "desc"));
      const snapshot = await getDocs(q);

      const list = [];
      snapshot.forEach((doc) => list.push(doc.data()));
      setVersions(list);
    } catch (error) {
      console.error("加载版本历史失败", error);
    } finally {
      setLoading(false);
    }
  };

  const getVersionTag = (v) => {
    if (v.type === "major")
      return (
        <Tag color="#f50" icon={<RocketOutlined />}>
          {v.versionStr}
        </Tag>
      );
    if (v.type === "minor")
      return (
        <Tag color="blue" icon={<FileTextOutlined />}>
          {v.versionStr}
        </Tag>
      );
    return (
      <Tag color="default" icon={<EditOutlined />}>
        {v.versionStr}
      </Tag>
    );
  };

  const toggleExpand = (key) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal
      title={<div style={{ fontWeight: 600, fontSize: 18 }}>版本变更日志</div>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
      bodyStyle={{ maxHeight: "70vh", overflowY: "auto", padding: "24px 32px" }}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : versions.length === 0 ? (
        <Empty description="暂无历史版本记录" />
      ) : (
        <div style={{ marginTop: 20 }}>
          {/* 
             不设置 mode="left/right"，也不设置 label，
             让 Antd 使用最默认的垂直布局：左侧轴线，右侧内容
          */}
          <Timeline>
            {versions.map((v, index) => {
              const logs = v.changeLog || [];
              const isLong = logs.length > 5;
              const isExpanded = expandedKeys[index];
              const displayLogs = isExpanded ? logs : logs.slice(0, 5);

              return (
                <Timeline.Item
                  key={index}
                  color={
                    v.type === "major"
                      ? "red"
                      : v.type === "minor"
                      ? "blue"
                      : "gray"
                  }
                >
                  {/* --- 头部信息行：版本 + 时间 + 用户 --- */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    {getVersionTag(v)}

                    <span
                      style={{
                        color: "#999",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {new Date(v.createdAt).toLocaleString()}
                    </span>

                    <span
                      style={{
                        color: "#666",
                        fontSize: 13,
                        background: "#f5f5f5",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      <UserOutlined style={{ marginRight: 4 }} />
                      {v.editor?.name || "未知用户"}
                    </span>
                  </div>

                  {/* --- 备注信息 --- */}
                  {v.remark && (
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#333",
                        marginBottom: 8,
                        fontSize: 14,
                        paddingLeft: 2,
                      }}
                    >
                      {v.remark}
                    </div>
                  )}

                  {/* --- 变更日志详情卡片 --- */}
                  {logs.length > 0 ? (
                    <div
                      style={{
                        background: "#f8f9fa",
                        padding: "12px 16px",
                        borderRadius: 8,
                        border: "1px solid #eee",
                        maxWidth: "95%", // 留一点边距
                      }}
                    >
                      <ul style={{ paddingLeft: 18, margin: 0 }}>
                        {displayLogs.map((log, idx) => (
                          <li
                            key={idx}
                            style={{
                              fontSize: 13,
                              color: "#555",
                              marginBottom: 4,
                              lineHeight: 1.5,
                            }}
                          >
                            {log}
                          </li>
                        ))}
                      </ul>

                      {isLong && (
                        <div style={{ marginTop: 8, paddingLeft: 18 }}>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => toggleExpand(index)}
                            style={{ padding: 0, height: "auto", fontSize: 12 }}
                            icon={
                              isExpanded ? <UpOutlined /> : <DownOutlined />
                            }
                          >
                            {isExpanded
                              ? "收起"
                              : `查看剩余 ${logs.length - 5} 条详情`}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, fontStyle: "italic" }}
                    >
                      无详细变更记录
                    </Text>
                  )}
                </Timeline.Item>
              );
            })}
          </Timeline>
        </div>
      )}
    </Modal>
  );
};

export default VersionHistoryModal;
