import React, { useState, useEffect } from "react";
import { Typography, Tag, Divider, Empty, Switch } from "antd";
import {
  RightOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  DownOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  LinkOutlined,
} from "@ant-design/icons";

const { Title, Text: AntText } = Typography;

const LEVEL_COLORS = [
  "#1677ff",
  "#52c41a",
  "#faad14",
  "#722ed1",
  "#eb2f96",
  "#13c2c2",
];

const SOPTextView = ({
  nodes,
  edges,
  flowMeta,
  selectedId,
  onSelect,
  collapsedNodeIds,
  toggleNodeCollapse,
}) => {
  // --- 核心修改：增加记忆功能 ---
  const [enableIndent, setEnableIndent] = useState(() => {
    // 从本地存储读取，默认为 true
    const stored = localStorage.getItem("SOP_DOC_INDENT");
    return stored === null ? true : stored === "true";
  });

  // 监听变化并保存
  useEffect(() => {
    localStorage.setItem("SOP_DOC_INDENT", enableIndent);
  }, [enableIndent]);

  if (!nodes || nodes.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          color: "#999",
        }}
      >
        <Empty description="暂无文档内容" />
      </div>
    );
  }

  const contentNodes = nodes.filter((n) => n.computedCode !== "0");

  const hasChildrenMap = new Map();
  edges.forEach((e) => {
    hasChildrenMap.set(e.source, true);
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const isAncestorCollapsed = (nodeId) => {
    if (collapsedNodeIds.has(nodeId)) return true;
    const node = nodeMap.get(nodeId);
    if (!node || !node.parentIds) return false;
    return node.parentIds.some((pid) => isAncestorCollapsed(pid));
  };

  const isNodeVisible = (node) => {
    if (!node.parentIds || node.parentIds.length === 0) return true;
    return !node.parentIds.some((pid) => isAncestorCollapsed(pid));
  };

  const visibleContentNodes = contentNodes.filter(isNodeVisible);

  return (
    <div
      style={{
        background: "#f0f2f5",
        height: "100%",
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileTextOutlined style={{ color: "#1890ff", fontSize: 16 }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>文档预览</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#666" }}>
            {enableIndent ? "缩进" : "平铺"}
          </span>
          <Switch
            size="small"
            checked={enableIndent}
            onChange={setEnableIndent}
            checkedChildren={<MenuUnfoldOutlined />}
            unCheckedChildren={<MenuFoldOutlined />}
          />
        </div>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          background: "#fff",
          minHeight: "80vh",
          padding: "40px 48px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          borderRadius: "8px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={3} style={{ margin: "0 0 8px 0", color: "#262626" }}>
            {flowMeta?.name || "未命名流程"}
          </Title>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <AntText
              type="secondary"
              style={{ fontSize: 11, fontFamily: "monospace" }}
            >
              ID: {flowMeta?.id}
            </AntText>
            <AntText type="secondary" style={{ fontSize: 11 }}>
              {new Date().toLocaleDateString()}
            </AntText>
          </div>
        </div>
        <Divider style={{ margin: "0 0 24px 0", borderColor: "#f0f0f0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {visibleContentNodes.map((node) => {
            let jumpTargetText = null;
            if (node.data.jumpTargetId) {
              const target = nodes.find((n) => n.id === node.data.jumpTargetId);
              if (target) {
                jumpTargetText = `跳转至: [${target.computedCode}] ${target.data.label}`;
              }
            }

            const level = node.computedCode
              ? node.computedCode.split(".").length - 1
              : 0;
            const isSelected = node.id === selectedId;
            const description = node.data.description;
            const hasChild = hasChildrenMap.get(node.id);
            const isCollapsed = collapsedNodeIds.has(node.id);

            const indentMargin = enableIndent ? level * 24 : 0;
            const codeColor = enableIndent
              ? "#1890ff"
              : LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length] || "#1890ff";

            const fontSize = Math.max(14 - level * 0.5, 12);

            return (
              <div
                key={node.id}
                id={`doc-node-${node.id}`}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  marginLeft: indentMargin,
                  background: isSelected ? "#e6f7ff" : "transparent",
                  borderLeft: isSelected
                    ? "3px solid #1890ff"
                    : "3px solid transparent",
                  transition: "all 0.1s ease",
                }}
                className="doc-node-item"
                onClick={() => onSelect(node.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#fafafa";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {enableIndent && level > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: -12,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: "#f0f0f0",
                    }}
                  />
                )}

                <div
                  style={{
                    width: 16,
                    marginRight: 4,
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 5,
                    cursor: "pointer",
                    color: "#999",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasChild) toggleNodeCollapse(node.id);
                  }}
                >
                  {hasChild ? (
                    isCollapsed ? (
                      <RightOutlined style={{ fontSize: 9 }} />
                    ) : (
                      <DownOutlined style={{ fontSize: 9 }} />
                    )
                  ) : null}
                </div>

                <div
                  style={{
                    fontFamily: "Consolas, monospace",
                    fontSize: 12,
                    color: codeColor,
                    fontWeight: "bold",
                    marginRight: 8,
                    marginTop: 3,
                    minWidth: enableIndent ? "auto" : 50,
                  }}
                >
                  {node.computedCode}
                </div>

                <div style={{ flex: 1, paddingTop: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 2,
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: fontSize,
                        fontWeight: 500,
                        color: node.data.label ? "#333" : "#bbb",
                      }}
                    >
                      {node.data.label || "(未命名)"}
                    </span>

                    {jumpTargetText && (
                      <Tag
                        icon={<LinkOutlined />}
                        bordered={false}
                        style={{
                          fontSize: 11,
                          margin: 0,
                          padding: "0 6px",
                          cursor: "default",
                          color: "#888",
                          background: "#f5f5f5",
                        }}
                      >
                        {jumpTargetText}
                      </Tag>
                    )}
                  </div>

                  {description && (
                    <div
                      style={{
                        color: "#666",
                        fontSize: 12,
                        lineHeight: "1.4",
                        marginTop: 0,
                        opacity: 0.8,
                      }}
                    >
                      {description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 40,
            textAlign: "center",
            borderTop: "1px dashed #f0f0f0",
            paddingTop: 16,
          }}
        >
          <AntText disabled style={{ fontSize: 12 }}>
            <NodeIndexOutlined /> End of Document
          </AntText>
        </div>
      </div>
    </div>
  );
};

export default SOPTextView;
