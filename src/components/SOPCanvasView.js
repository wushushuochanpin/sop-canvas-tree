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
// 尺寸缩小：更紧凑
const NODE_WIDTH = 120;
const NODE_HEIGHT = 45;

// --- 内置布局算法 ---
const getLayoutedElements = (nodes, edges, direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    // 节点变小了，间距也可以相应缩小
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
      {/* 背景改为极淡的蓝色圆点，呼应蓝色主题 */}
      <Background color="#e6f7ff" gap={20} size={1} />

      {/* 控件样式：稍微圆润一点，淡蓝色边框 */}
      <Controls
        showInteractive={false}
        style={{
          marginBottom: 60,
          borderRadius: 4,
          border: "1px solid #bae0ff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        }}
      />

      {/* 布局切换面板 */}
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
  const [layoutDirection, setLayoutDirection] = useState("TB");

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const flowNodes = visibleNodes.map((n) => {
      const isDraft = !n.data.label;
      const hasChildren = sopData.edges.some((e) => e.source === n.id);
      const isCollapsed = collapsedNodeIds.has(n.id);
      const isSelected = n.id === editingNodeId;

      // 跳转信息
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
                padding: "0 8px", // 内边距减小
                boxSizing: "border-box",
                gap: 8,
              }}
            >
              {/* 1. 序号 (Code) - 淡蓝底深蓝字，圆角 */}
              <div
                style={{
                  flexShrink: 0,
                  background: "#e6f7ff", // 极淡蓝
                  color: "#1677ff", // 品牌蓝
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

              {/* 2. 标题文字 - 超出省略 */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden", // 关键：超出隐藏
                }}
              >
                <Tooltip
                  title={n.data.label} // Hover 显示完整内容
                  placement="top"
                  mouseEnterDelay={0.3}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isDraft ? "#bfbfbf" : "#333", // 文字颜色保持深灰，保证阅读性
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      whiteSpace: "nowrap", // 关键：不换行
                      overflow: "hidden", // 关键：超出隐藏
                      textOverflow: "ellipsis", // 关键：省略号
                      width: "100%", // 确保占满 flex 剩余空间
                      display: "block",
                    }}
                  >
                    {n.data.label || "未命名节点"}
                  </span>
                </Tooltip>
              </div>

              {/* 3. 图标区 (右侧) */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {/* 数据图标 */}
                {Object.keys(n.aggregatedData).length > 0 && (
                  <Tooltip title="存在随路数据">
                    <DatabaseOutlined
                      style={{ fontSize: 10, color: "#faad14" }}
                    />
                  </Tooltip>
                )}

                {/* 跳转指示 - 蓝色小箭头 */}
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

                {/* 折叠/展开 - 蓝色加减号 */}
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
          // 边框逻辑：选中深蓝粗框，未选中淡蓝细框
          border: isSelected ? "2px solid #1677ff" : "1px solid #91caff",
          borderRadius: 6, // 圆角 6px
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
      pathOptions: { borderRadius: 4 }, // 连线圆角稍小，匹配节点尺寸
      animated: false,
      style: { stroke: "#91caff", strokeWidth: 1 }, // 连线改为淡蓝色
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 5,
        height: 5,
        color: "#91caff", // 箭头同色
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
