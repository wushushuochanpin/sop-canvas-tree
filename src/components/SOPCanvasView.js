import React, { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { Tag, Tooltip, Typography } from "antd";
import {
  DatabaseOutlined,
  PlusSquareOutlined,
  MinusSquareOutlined,
} from "@ant-design/icons";
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  getLayoutedElements,
} from "../utils/graphLogic";

const { Text } = Typography;

// --- 内部 Wrapper 组件 ---
const ReactFlowWrapper = ({
  rfNodes,
  rfEdges,
  setRfInstance,
  handleNodeSelect,
  layoutDeps,
}) => {
  const { fitView } = useReactFlow();
  const instance = useReactFlow();

  useEffect(() => {
    setRfInstance(instance);
  }, [instance, setRfInstance]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.1, duration: 300 });
    }, 150);
    return () => clearTimeout(timer);
  }, [rfNodes.length, rfEdges.length, fitView, ...layoutDeps]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodeClick={(e, node) => handleNodeSelect(node.id)}
      nodesConnectable={false}
      nodesDraggable={false}
      minZoom={0.2}
      fitView
      attributionPosition="bottom-right"
    >
      <Background color="#f8f8f8" gap={12} size={1} />
      <Controls
        showInteractive={false}
        style={{ transform: "scale(0.8)", transformOrigin: "bottom left" }}
      />
      <Panel
        position="top-left"
        style={{
          padding: "2px 6px",
          background: "rgba(255,255,255,0.7)",
          borderRadius: 4,
        }}
      >
        <Text type="secondary" style={{ fontSize: 10 }}>
          Auto Layout
        </Text>
      </Panel>
    </ReactFlow>
  );
};

// --- 对外的主组件 ---
const SOPCanvasView = ({
  sopData,
  visibleNodes,
  allNodesWithCode,
  collapsedNodeIds,
  editingNodeId,
  setRfInstance,
  handleNodeSelect,
  handleJumpTo,
  toggleNodeCollapse,
  layoutDeps,
}) => {
  // --- React Flow Render Data 生成逻辑 ---
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const flowNodes = visibleNodes.map((n) => {
      const isDraft = !n.data.label;
      const hasChildren = sopData.edges.some((e) => e.source === n.id);
      const isCollapsed = collapsedNodeIds.has(n.id);

      let jumpInfo = null;
      if (n.data.jumpTargetId) {
        const target = allNodesWithCode.find(
          (tn) => tn.id === n.data.jumpTargetId
        );
        jumpInfo = target
          ? { code: target.computedCode, name: target.data.label }
          : { code: "?", name: "未知" };
      }

      return {
        id: n.id,
        type:
          n.parentIds.length === 0
            ? "input"
            : n.childrenIds.length === 0
            ? "output"
            : "default",
        data: {
          label: (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px",
                boxSizing: "border-box",
                fontSize: 11,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  flex: 1,
                }}
              >
                <Tag
                  color="#108ee9"
                  style={{
                    marginRight: 6,
                    padding: "0 4px",
                    fontSize: 10,
                    lineHeight: "16px",
                    border: "none",
                    fontWeight: 700,
                  }}
                >
                  {n.computedCode}
                </Tag>
                <Tooltip
                  title={n.data.label}
                  placement="topLeft"
                  mouseEnterDelay={0.3}
                >
                  <span
                    style={{
                      fontFamily:
                        '"Microsoft YaHei", "PingFang SC", sans-serif',
                      fontWeight: 400,
                      color: isDraft ? "#bfbfbf" : "#595959",
                      fontStyle: isDraft ? "italic" : "normal",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "block",
                      maxWidth: "100%",
                      cursor: "default",
                    }}
                  >
                    {n.data.label || "(未命名)"}
                  </span>
                </Tooltip>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {Object.keys(n.aggregatedData).length > 0 && (
                  <Tooltip
                    title={`数据: ${Object.keys(n.aggregatedData).join(", ")}`}
                  >
                    <DatabaseOutlined
                      style={{ color: "#faad14", fontSize: 10 }}
                    />
                  </Tooltip>
                )}
                {jumpInfo && (
                  <Tooltip
                    title={`跳转至: [${jumpInfo.code}] ${jumpInfo.name}`}
                  >
                    <div
                      className="nodrag"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJumpTo(n.data.jumpTargetId);
                      }}
                      style={{
                        cursor: "pointer",
                        background: "#fff1f0",
                        borderRadius: 2,
                        padding: "0 4px",
                        height: 16,
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid #ffa39e",
                        color: "#cf1322",
                        fontSize: 9,
                        fontWeight: "bold",
                      }}
                    >
                      ↬ {jumpInfo.code}
                    </div>
                  </Tooltip>
                )}
                {hasChildren && (
                  <div
                    className="nodrag"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeCollapse(n.id);
                    }}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: "#1890ff",
                    }}
                  >
                    {isCollapsed ? (
                      <PlusSquareOutlined />
                    ) : (
                      <MinusSquareOutlined />
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        },
        style: {
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          border:
            n.id === editingNodeId ? "2px solid #1890ff" : "1px solid #d9d9d9",
          borderRadius: 6,
          background: "#fff",
          boxShadow:
            n.id === editingNodeId
              ? "0 0 8px rgba(24,144,255,0.4)"
              : "0 1px 2px rgba(0,0,0,0.05)",
          padding: 0,
          cursor: "default",
        },
      };
    });

    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const rawEdges = sopData.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    const edgesBySource = {};
    rawEdges.forEach((e) => {
      if (!edgesBySource[e.source]) edgesBySource[e.source] = [];
      edgesBySource[e.source].push(e);
    });

    let flowEdges = [];
    Object.values(edgesBySource).forEach((siblingEdges) => {
      siblingEdges.forEach((e, index) => {
        const isEven = index % 2 === 0;
        const edgeColor = isEven ? "#8c8c8c" : "#1890ff";
        flowEdges.push({
          ...e,
          type: "smoothstep",
          pathOptions: { borderRadius: 5, offset: 15 },
          animated: false,
          style: { stroke: edgeColor, strokeWidth: 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 8,
            height: 8,
            color: edgeColor,
          },
        });
      });
    });

    return getLayoutedElements(flowNodes, flowEdges);
  }, [
    visibleNodes,
    allNodesWithCode,
    sopData.edges,
    editingNodeId,
    collapsedNodeIds,
    handleJumpTo,
    toggleNodeCollapse,
  ]);

  return (
    <ReactFlowProvider>
      <ReactFlowWrapper
        rfNodes={rfNodes}
        rfEdges={rfEdges}
        setRfInstance={setRfInstance}
        handleNodeSelect={handleNodeSelect}
        layoutDeps={layoutDeps}
      />
    </ReactFlowProvider>
  );
};

export default SOPCanvasView;
