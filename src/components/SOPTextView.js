import React from "react";
import { Typography, Tag } from "antd";

const { Title } = Typography;

const SOPTextView = ({ nodes, selectedId, onSelect }) => {
  return (
    <div
      style={{
        padding: "24px 40px",
        background: "#fff",
        height: "100%",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Title level={4} style={{ marginBottom: 24, textAlign: "center" }}>
          SOP 流程文档预览
        </Title>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {nodes.map((node) => {
            const level = node.computedCode
              ? node.computedCode.split(".").length - 1
              : 0;
            const isSelected = node.id === selectedId;

            return (
              <div
                key={node.id}
                onClick={() => onSelect(node.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  marginLeft: level * 24,
                  background: isSelected ? "#e6f7ff" : "transparent",
                  borderLeft: isSelected
                    ? "3px solid #1890ff"
                    : "3px solid transparent",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = isSelected
                    ? "#e6f7ff"
                    : "#fafafa")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isSelected
                    ? "#e6f7ff"
                    : "transparent")
                }
              >
                {/* 序号 */}
                <span
                  style={{
                    fontWeight: "bold",
                    color: "#1890ff",
                    marginRight: 12,
                    fontFamily: "monospace",
                    fontSize: 14,
                    minWidth: 40,
                  }}
                >
                  {node.computedCode}
                </span>

                {/* 内容区域 */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: node.data.label ? "#333" : "#bfbfbf",
                      marginBottom: 4,
                    }}
                  >
                    {node.data.label || "(未命名节点)"}
                  </div>

                  {Object.keys(node.aggregatedData || {}).length > 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#888",
                        background: "#f5f5f5",
                        padding: "2px 6px",
                        borderRadius: 4,
                        display: "inline-block",
                      }}
                    >
                      包含数据: {Object.keys(node.aggregatedData).join(", ")}
                    </div>
                  )}
                </div>

                {/* 跳转标记 */}
                {node.data.jumpTargetId && (
                  <Tag color="orange" style={{ fontSize: 10, border: "none" }}>
                    跳转节点
                  </Tag>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 50,
            borderTop: "1px solid #eee",
            paddingTop: 20,
            textAlign: "center",
            color: "#ccc",
            fontSize: 12,
          }}
        >
          - 文档结束 -
        </div>
      </div>
    </div>
  );
};

export default SOPTextView;
