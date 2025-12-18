import React, { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { Tooltip, Typography, Radio } from "antd";
import {
  DatabaseOutlined,
  PlusSquareOutlined,
  MinusSquareOutlined,
  ArrowDownOutlined,
  ArrowRightOutlined,
  AimOutlined,
} from "@ant-design/icons";

// --- 常量定义 ---
const NODE_WIDTH = 160;
const NODE_HEIGHT = 42;

// --- 内置布局算法 ---
const getLayoutedElements = (nodes, edges, direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: direction === "TB" ? 40 : 30,
    ranksep: direction === "TB" ? 40 : 60,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    let targetPosition = Position.Top;
    let sourcePosition = Position.Bottom;

    if (direction === "LR") {
      targetPosition = Position.Left;
      sourcePosition = Position.Right;
    }

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const { Text: AntText } = Typography;

const ReactFlowWrapper = ({
  rfNodes,
  rfEdges,
  setRfInstance,
  handleNodeSelect,
  layoutDeps,
  layoutDirection,
  setLayoutDirection,
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
  }, [rfNodes.length, rfEdges.length, fitView, layoutDirection, ...layoutDeps]);

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
      <Background color="#e6f7ff" gap={20} size={1} />

      <Controls
        showInteractive={false}
        style={{
          marginBottom: 60,
          borderRadius: 4,
          border: "1px solid #bae0ff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        }}
      />

      <Panel
        position="top-left"
        style={{
          padding: "4px 8px",
          background: "#fff",
          border: "1px solid #bae0ff",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        }}
      >
        <AntText type="secondary" style={{ fontSize: 11 }}>
          Layout:
        </AntText>
        <Radio.Group
          value={layoutDirection}
          onChange={(e) => setLayoutDirection(e.target.value)}
          size="small"
          buttonStyle="solid"
        >
          <Radio.Button value="TB" style={{ fontSize: 12 }}>
            <ArrowDownOutlined />
          </Radio.Button>
          <Radio.Button value="LR" style={{ fontSize: 12 }}>
            <ArrowRightOutlined />
          </Radio.Button>
        </Radio.Group>
      </Panel>
    </ReactFlow>
  );
};

const SOPCanvasView = ({
  sopData,
  visibleNodes,
  allNodesWithCode,
  collapsedNodeIds,
  editingNodeId,
  setRfInstance,
  handleNodeSelect,
  toggleNodeCollapse,
  layoutDeps,
}) => {
  // --- 核心修改：增加记忆功能 ---
  const [layoutDirection, setLayoutDirection] = useState(() => {
    return localStorage.getItem("SOP_CANVAS_DIRECTION") || "TB";
  });

  // 监听变化并保存
  useEffect(() => {
    localStorage.setItem("SOP_CANVAS_DIRECTION", layoutDirection);
  }, [layoutDirection]);

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const flowNodes = visibleNodes.map((n) => {
      const isDraft = !n.data.label;
      const hasChildren = sopData.edges.some((e) => e.source === n.id);
      const isCollapsed = collapsedNodeIds.has(n.id);
      const isSelected = n.id === editingNodeId;

      let jumpInfo = null;
      if (n.data.jumpTargetId) {
        const target = allNodesWithCode.find(
          (tn) => tn.id === n.data.jumpTargetId
        );
        jumpInfo = target ? { code: target.computedCode } : { code: "?" };
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
                flexDirection: "row",
                alignItems: "center",
                padding: "0 8px",
                boxSizing: "border-box",
                gap: 8,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  background: "#e6f7ff",
                  color: "#1677ff",
                  border: "1px solid #bae0ff",
                  fontSize: 10,
                  fontWeight: "bold",
                  padding: "0 5px",
                  height: 18,
                  lineHeight: "16px",
                  borderRadius: 4,
                  fontFamily: "monospace",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {n.computedCode}
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <Tooltip
                  title={n.data.label}
                  placement="top"
                  mouseEnterDelay={0.3}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isDraft ? "#bfbfbf" : "#333",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      width: "100%",
                      display: "block",
                    }}
                  >
                    {n.data.label || "未命名节点"}
                  </span>
                </Tooltip>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {Object.keys(n.aggregatedData).length > 0 && (
                  <Tooltip title="存在随路数据">
                    <DatabaseOutlined
                      style={{ fontSize: 10, color: "#faad14" }}
                    />
                  </Tooltip>
                )}
                {jumpInfo && (
                  <Tooltip title={`跳转至 ${jumpInfo.code}`}>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#1677ff",
                        cursor: "help",
                        display: "flex",
                        alignItems: "center",
                        background: "#f0f5ff",
                        padding: "0 2px",
                        borderRadius: 2,
                      }}
                    >
                      <AimOutlined style={{ fontSize: 9 }} />
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
                      color: "#1677ff",
                      fontSize: 12,
                      marginLeft: 2,
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
          background: "#fff",
          border: isSelected ? "2px solid #1677ff" : "1px solid #91caff",
          borderRadius: 6,
          boxShadow: isSelected ? "0 0 0 2px rgba(22, 119, 255, 0.1)" : "none",
          padding: 0,
          cursor: "default",
          zIndex: isSelected ? 10 : 1,
        },
      };
    });

    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const rawEdges = sopData.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    let flowEdges = rawEdges.map((e) => ({
      ...e,
      type: "smoothstep",
      pathOptions: { borderRadius: 4 },
      animated: false,
      style: { stroke: "#91caff", strokeWidth: 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 5,
        height: 5,
        color: "#91caff",
      },
    }));

    return getLayoutedElements(flowNodes, flowEdges, layoutDirection);
  }, [
    visibleNodes,
    allNodesWithCode,
    sopData.edges,
    editingNodeId,
    collapsedNodeIds,
    toggleNodeCollapse,
    layoutDirection,
  ]);

  return (
    <ReactFlowProvider>
      <ReactFlowWrapper
        rfNodes={rfNodes}
        rfEdges={rfEdges}
        setRfInstance={setRfInstance}
        handleNodeSelect={handleNodeSelect}
        layoutDeps={layoutDeps}
        layoutDirection={layoutDirection}
        setLayoutDirection={setLayoutDirection}
      />
    </ReactFlowProvider>
  );
};

export default SOPCanvasView;
