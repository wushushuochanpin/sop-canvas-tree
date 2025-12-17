import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
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
import {
  Tree,
  Button,
  Input,
  message,
  Select,
  Tag,
  Form,
  Card,
  Typography,
  Tooltip,
  Modal,
  Space,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CloseOutlined,
  DatabaseOutlined,
  SaveOutlined,
  AppstoreOutlined,
  AimOutlined,
  NumberOutlined,
  DragOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  MinusSquareOutlined,
  PlusSquareOutlined,
} from "@ant-design/icons";
import { v4 as uuidv4 } from "uuid";

const { Option } = Select;
const { Title, Text } = Typography;

// --- 1. 布局参数 ---
const NODE_WIDTH = 80;
const NODE_HEIGHT = 26;
const RANK_SEP = 50;
const NODE_SEP = 20;

// --- 2. 布局算法 ---
// 修复：给参数加默认值 nodes = [], edges = []
const getLayoutedElements = (nodes = [], edges = []) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 设置布局方向和间距
  dagreGraph.setGraph({
    rankdir: "LR",
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
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
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- 3. 核心数据处理 (序号生成 & 折叠过滤) ---
// 修复：给参数加默认值 nodes = [], edges = [], collapsedIds = new Set()
const processGraphData = (nodes = [], edges = [], collapsedIds = new Set()) => {
  const nodeMap = new Map(
    nodes.map((n) => [
      n.id,
      {
        ...n,
        childrenIds: [],
        parentIds: [],
        computedCode: "",
        aggregatedData: {},
      },
    ])
  );

  // 建立关系
  edges.forEach((edge) => {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) {
      parent.childrenIds.push(child.id);
      child.parentIds.push(parent.id);
    }
  });

  const roots = [];
  nodeMap.forEach((node) => {
    if (node.parentIds.length === 0) roots.push(node);
  });

  const visited = new Set();
  const visibleNodes = []; // 仅收集未被折叠隐藏的节点

  // 递归遍历
  // isHidden: 标记当前节点是否因为祖先被折叠而隐藏
  const traverse = (nodeId, codePrefix, parentData, isHidden) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    // 1. 计算序号
    if (!node.computedCode) node.computedCode = codePrefix;

    // 2. 聚合数据
    const currentData = { ...parentData, ...node.data.payload };
    node.aggregatedData = { ...node.aggregatedData, ...currentData };

    // 3. 收集可见节点
    // 只有当自己不处于 hidden 状态时，才会被收集到最终的 nodes 数组中
    if (!isHidden) {
      visibleNodes.push(node);
    }

    if (visited.has(nodeId + codePrefix)) return;
    visited.add(nodeId + codePrefix);

    // 4. 判断子节点是否应该被隐藏
    // 如果当前节点是 hidden 的，或者当前节点 ID 在 collapsedIds 里，那么子节点就是 hidden 的
    const isChildrenHidden = isHidden || collapsedIds.has(nodeId);

    node.childrenIds.forEach((childId, index) => {
      let childCode;
      if (node.computedCode === "0") {
        childCode = (index + 1).toString();
      } else {
        childCode = `${node.computedCode}.${index + 1}`;
      }
      traverse(childId, childCode, node.aggregatedData, isChildrenHidden);
    });
  };

  roots.forEach((root) => {
    traverse(root.id, "0", {}, false);
  });

  return visibleNodes; // 返回处理过且过滤后的节点列表
};

// --- 4. Tree Data 构建 ---
// 修复：给参数加默认值 nodes = [], edges = []
const buildTreeData = (nodes = [], edges = []) => {
  // 注意：这里传入的 nodes 应该是全量 nodes (sopData.nodes)，而不是过滤后的
  // 这样 Tree 里才能完整显示，画布里折叠不影响 Tree 的结构
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  // 这里的 code 需要重新计算一次或者复用 processGraphData 的结果(如果 Tree 不折叠)
  // 为了简单，我们在组件内部计算完 processGraphData 后，把带 code 的全量数据传进来

  const getChildren = (parentId) => {
    // 按照 edges 的顺序来排序 children，保证拖拽后的顺序一致
    return edges
      .filter((e) => e.source === parentId)
      .map((e) => nodeMap.get(e.target))
      .filter(Boolean);
  };

  const recursiveBuild = (node) => {
    const children = getChildren(node.id);
    const displayTitle = node.data.label ? (
      node.data.label
    ) : (
      <span style={{ color: "#ccc" }}>(未命名草稿)</span>
    );

    return {
      key: node.id,
      title: displayTitle,
      code: node.computedCode, // 需要 node 对象里已经有了 computedCode
      jumpTo: node.data.jumpTargetId,
      children: children.map((child) => recursiveBuild(child)),
    };
  };

  // 找根节点
  const rootIds = nodes
    .filter((n) => !edges.find((e) => e.target === n.id))
    .map((n) => n.id);

  return rootIds
    .map((id) => {
      const node = nodeMap.get(id);
      return node ? recursiveBuild(node) : null;
    })
    .filter(Boolean);
};

// --- 5. 拖拽组件 ---
const Resizer = ({ onResize }) => {
  const isResizing = useRef(false);
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      onResize(e.movementX);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "default";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize]);
  return (
    <div
      onMouseDown={() => {
        isResizing.current = true;
        document.body.style.cursor = "col-resize";
      }}
      style={{
        width: 6,
        cursor: "col-resize",
        background: "#f5f5f5",
        borderLeft: "1px solid #e8e8e8",
        borderRight: "1px solid #e8e8e8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}
    >
      <DragOutlined
        style={{ fontSize: 8, color: "#bfbfbf", transform: "rotate(90deg)" }}
      />
    </div>
  );
};

// --- 主组件 ---
const SOPEditorLayout = () => {
  const [form] = Form.useForm();
  // --- 走马灯标题特效 ---
  useEffect(() => {
    // 1. 定义你要滚动的文字（注意：后面多加几个空格，不然首尾相接太紧不好看）
    const text = "SOP 流程编排系统 - 专业的逻辑设计工具      ";

    // 定义一个临时变量用来存当前的滚动状态
    let currentText = text;

    // 2. 设置定时器，每 300 毫秒执行一次
    const timer = setInterval(() => {
      // 算法：把第一个字切下来，贴到最后面去
      const firstChar = currentText.charAt(0);
      const restText = currentText.substring(1);

      currentText = restText + firstChar;

      // 3. 修改浏览器标题
      document.title = currentText;
    }, 300); // 300 是速度，数值越小滚得越快

    // 4. 清理函数：当组件销毁时，关掉定时器，防止内存泄漏
    return () => {
      clearInterval(timer);
      document.title = "SOP 流程编排"; // 恢复成静态标题
    };
  }, []);
  const fileInputRef = useRef(null);

  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const minWidth = 200;

  // 业务数据
  const [sopData, setSopData] = useState({
    nodes: [
      {
        id: uuidv4(),
        position: { x: 0, y: 0 },
        data: { label: "开始", payload: { mobile: "138xxxx" } },
        type: "input",
      },
    ],
    edges: [],
  });

  const [editingNodeId, setEditingNodeId] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);

  // 状态：树的展开节点Keys
  const [expandedKeys, setExpandedKeys] = useState([]);
  // 状态：画布的折叠节点IDs (Set)
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  // --- 核心计算 ---

  // 1. 全量计算 (为了给 Tree 用，Tree 需要显示所有节点，并获取正确的 Code)
  // 这里传入空的 collapsedIds，保证拿到所有节点的 code
  const allNodesWithCode = useMemo(() => {
    return processGraphData(sopData.nodes, sopData.edges, new Set());
  }, [sopData]);

  // 2. 画布可视计算 (为了给 ReactFlow 用，过滤掉折叠的)
  const visibleNodesForCanvas = useMemo(() => {
    return processGraphData(sopData.nodes, sopData.edges, collapsedNodeIds);
  }, [sopData, collapsedNodeIds]);

  // 3. 构建树结构
  const treeData = useMemo(
    () => buildTreeData(allNodesWithCode, sopData.edges),
    [allNodesWithCode, sopData.edges]
  );

  // --- React Flow Render Data ---
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    // 使用 visibleNodesForCanvas 来生成画布节点
    const flowNodes = visibleNodesForCanvas.map((n) => {
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
                <span
                  style={{
                    // 1. 字体设置在这里！！！
                    // 这里的例子是【微软雅黑】，你想换楷体就复制上面的方案B
                    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',

                    fontWeight: 400, // 细一点
                    color: isDraft ? "#bfbfbf" : "#595959",

                    // ... 其他样式保持不变 ...
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
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {/* 聚合数据图标 */}
                {Object.keys(n.aggregatedData).length > 0 && (
                  <Tooltip
                    title={`数据: ${Object.keys(n.aggregatedData).join(", ")}`}
                  >
                    <DatabaseOutlined
                      style={{ color: "#faad14", fontSize: 10 }}
                    />
                  </Tooltip>
                )}
                {/* 跳转图标 */}
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
                {/* 折叠/展开按钮 (仅当有子节点时显示) */}
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

    // 过滤 Edges: 只有当 Source 和 Target 都在 visibleNodesForCanvas 里时，才显示连线
    const visibleIds = new Set(visibleNodesForCanvas.map((n) => n.id));
    const rawEdges = sopData.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    // 连线样式 (隔行变色)
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
          pathOptions: { borderRadius: 1 },
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
    visibleNodesForCanvas,
    allNodesWithCode,
    sopData.edges,
    editingNodeId,
    collapsedNodeIds,
  ]);

  // --- Actions ---

  // 1. 折叠/展开节点 (Canvas)
  const toggleNodeCollapse = (nodeId) => {
    const newSet = new Set(collapsedNodeIds);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId); // 展开
    } else {
      newSet.add(nodeId); // 折叠
    }
    setCollapsedNodeIds(newSet);
  };

  // 2. 树形图拖拽 (自动重排序号的核心)
  const onTreeDrop = (info) => {
    const dropKey = info.node.key; // 目标节点 ID
    const dragKey = info.dragNode.key; // 被拖拽节点 ID
    const dropPos = info.node.pos.split("-");
    const dropPosition =
      info.dropPosition - Number(dropPos[dropPos.length - 1]); // AntD 特有的位置计算 (-1:上方, 0:内部, 1:下方)

    // 根节点保护
    if (dragKey === sopData.nodes[0].id) {
      message.warning("根节点不可移动");
      return;
    }

    // 1. 找到被拖拽节点当前的父边，并移除
    let newEdges = sopData.edges.filter((e) => e.target !== dragKey);
    const draggedNodeEdge = sopData.edges.find((e) => e.target === dragKey);
    // const oldParentId = draggedNodeEdge?.source;

    // 2. 确定新的父节点和插入位置
    let newParentId;
    let insertIndex; // 在新父节点的 children 中的索引

    if (!info.dropToGap) {
      // Drop 在节点上 -> 成为子节点 (插在最后)
      newParentId = dropKey;
      // 找到该父节点现有的所有边，插在末尾
      const siblingEdges = newEdges.filter((e) => e.source === newParentId);
      insertIndex = siblingEdges.length;
    } else {
      // Drop 在缝隙 (排序) -> 成为兄弟节点
      // 目标节点的父节点就是新父节点
      const dropTargetEdge = sopData.edges.find((e) => e.target === dropKey);
      if (!dropTargetEdge) return; // 异常情况
      newParentId = dropTargetEdge.source;

      // 计算插入位置
      const siblingEdges = newEdges.filter((e) => e.source === newParentId);
      const dropTargetIndex = siblingEdges.findIndex(
        (e) => e.target === dropKey
      );

      if (dropPosition === -1) {
        insertIndex = dropTargetIndex; // 插在目标上方
      } else {
        insertIndex = dropTargetIndex + 1; // 插在目标下方
      }
    }

    // 3. 构建新的边对象
    const newEdge = {
      id: `e${newParentId}-${dragKey}-${uuidv4()}`, // 重新生成ID避免冲突
      source: newParentId,
      target: dragKey,
    };

    // 4. 将新边插入到 edges 数组的正确位置
    // 注意：为了让 processGraphData 生成正确的序号 (1.1, 1.2)，edges 数组中 sibling 的顺序必须正确

    // 先把非相关边分离
    const otherEdges = newEdges.filter((e) => e.source !== newParentId);
    // 获取目标父节点现有的子边 (此时 newEdges 里已经没有 dragKey 的边了)
    const currentSiblingEdges = newEdges.filter(
      (e) => e.source === newParentId
    );

    // 在指定 index 插入
    currentSiblingEdges.splice(insertIndex, 0, newEdge);

    // 合并回去 (这里为了保持整体 edges 有序，可以简单合并，因为 dagre 布局和序号生成主要依赖 sibling 顺序)
    // 更好的做法是保持原有相对顺序，这里简化处理：先把别人的放前面，自己的放后面
    const finalEdges = [...otherEdges, ...currentSiblingEdges];

    setSopData((prev) => ({ ...prev, edges: finalEdges }));
    message.success("层级调整成功，序号已自动更新");
  };

  const addBranch = (parentId) => {
    const newNodeId = uuidv4();
    const newNode = {
      id: newNodeId,
      position: { x: 0, y: 0 },
      data: { label: "新节点", payload: {} },
    };
    const newEdge = {
      id: `e${parentId}-${newNodeId}`,
      source: parentId,
      target: newNodeId,
    };

    setSopData((prev) => ({
      nodes: [...prev.nodes, newNode],
      edges: [...prev.edges, newEdge],
    }));

    // --- 自动展开逻辑 ---
    // 将 parentId 加入 expandedKeys
    if (!expandedKeys.includes(parentId)) {
      setExpandedKeys((prev) => [...prev, parentId]);
    }

    handleNodeSelect(newNodeId);
  };

  // --- 通用功能 (导出/导入/保存) ---
  const handleExportFile = () => {
    const dataStr = JSON.stringify(sopData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sop-v4-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json && Array.isArray(json.nodes) && Array.isArray(json.edges)) {
          setSopData(json);
          setEditingNodeId(null);
          setExpandedKeys([]); // 重置展开状态
          setCollapsedNodeIds(new Set()); // 重置折叠状态
          message.success("导入成功");
        } else {
          message.error("格式错误");
        }
      } catch (err) {
        message.error("解析失败");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetData = () => {
    Modal.confirm({
      title: "确认重置？",
      content: "未保存的内容将丢失。",
      onOk: () => {
        setSopData({
          nodes: [
            {
              id: uuidv4(),
              position: { x: 0, y: 0 },
              data: { label: "开始", payload: { mobile: "138xxxx" } },
              type: "input",
            },
          ],
          edges: [],
        });
        setEditingNodeId(null);
        setExpandedKeys([]);
        setCollapsedNodeIds(new Set());
        message.success("已重置");
      },
    });
  };

  const deleteNode = (nodeId) => {
    const node = allNodesWithCode.find((n) => n.id === nodeId);
    if (node?.computedCode === "0") {
      message.warning("初始节点不可删除");
      return;
    }
    setSopData((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
    }));
    if (editingNodeId === nodeId) setEditingNodeId(null);
  };

  const handleJumpTo = (targetId) => {
    if (!targetId || !rfInstance) return;
    handleNodeSelect(targetId);
    rfInstance.fitView({
      nodes: [{ id: targetId }],
      padding: 0.5,
      duration: 500,
    });
    message.info("已定位");
  };

  const handleNodeSelect = (nodeId) => {
    setEditingNodeId(nodeId);
    const node = sopData.nodes.find((n) => n.id === nodeId);
    if (node) {
      form.resetFields();
      form.setFieldsValue({
        id: node.id,
        name: node.data.label,
        targetNodeId: node.data.jumpTargetId,
      });
    }
  };

  const handleSaveNode = (values) => {
    updateNodeData(values);
    message.success("保存成功");
  };
  const handleSaveDraft = () => {
    const values = form.getFieldsValue();
    updateNodeData(values);
    message.success("草稿已保存");
  };
  const updateNodeData = (values) => {
    const currentNode = sopData.nodes.find((n) => n.id === editingNodeId);
    const currentPayload = currentNode?.data.payload || {};
    const updatedPayload = values.payloadKey
      ? { ...currentPayload, [values.payloadKey]: values.payloadValue }
      : currentPayload;
    setSopData((prev) => ({
      nodes: prev.nodes.map((n) =>
        n.id === editingNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: values.name,
                payload: updatedPayload,
                jumpTargetId: values.targetNodeId,
              },
            }
          : n
      ),
      edges: prev.edges,
    }));
  };

  const currentEditNode = allNodesWithCode.find((n) => n.id === editingNodeId);
  const jumpTargets = allNodesWithCode.filter((n) => n.id !== editingNodeId);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #ddd",
          padding: "0 20px",
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <AppstoreOutlined
            style={{ fontSize: 18, color: "#1890ff", marginRight: 10 }}
          />
          <Title level={5} style={{ margin: 0 }}>
            SOP 流程编排 (Drag & Drop)
          </Title>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportFile}
          >
            导出
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            导入
          </Button>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleResetData}
          />
        </div>
      </div>

      {/* Main Layout */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Left: Tree */}
        <div
          style={{
            width: leftWidth,
            minWidth: 50,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              background: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Text strong style={{ fontSize: 12 }}>
              目录
            </Text>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            <div style={{ minWidth: 250 }}>
              <Tree
                className="draggable-tree"
                draggable
                blockNode
                // 控制展开状态
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onDrop={onTreeDrop} // 拖拽核心
                treeData={treeData}
                selectedKeys={[editingNodeId]}
                titleRender={(nodeData) => (
                  <div
                    className="flex items-center"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                    onClick={() => handleNodeSelect(nodeData.key)}
                  >
                    <span style={{ display: "flex", alignItems: "center" }}>
                      <Tag
                        color={editingNodeId === nodeData.key ? "blue" : ""}
                        style={{
                          marginRight: 4,
                          fontSize: 10,
                          lineHeight: "16px",
                          padding: "0 4px",
                          border:
                            editingNodeId === nodeData.key
                              ? "none"
                              : "1px solid #eee",
                        }}
                      >
                        {nodeData.code}
                      </Tag>
                      <span style={{ whiteSpace: "nowrap" }}>
                        {nodeData.title}
                      </span>
                      {nodeData.jumpTo && (
                        <AimOutlined
                          style={{
                            marginLeft: 4,
                            color: "#ff4d4f",
                            fontSize: 10,
                          }}
                        />
                      )}
                    </span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="text"
                        size="small"
                        icon={<PlusOutlined style={{ fontSize: 10 }} />}
                        onClick={() => addBranch(nodeData.key)}
                      />
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 10 }} />}
                        onClick={() => deleteNode(nodeData.key)}
                      />
                    </span>
                  </div>
                )}
              />
            </div>
          </div>
        </div>
        <Resizer
          onResize={(delta) =>
            setLeftWidth((prev) => Math.max(minWidth, prev + delta))
          }
        />

        {/* Center: Canvas */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <ReactFlowProvider>
            <ReactFlowWrapper
              rfNodes={rfNodes}
              rfEdges={rfEdges}
              setRfInstance={setRfInstance}
              handleNodeSelect={handleNodeSelect}
              layoutDeps={[
                leftWidth,
                rightWidth,
                editingNodeId,
                expandedKeys,
                collapsedNodeIds,
              ]}
            />
          </ReactFlowProvider>
        </div>
        {editingNodeId && (
          <Resizer
            onResize={(delta) =>
              setRightWidth((prev) => Math.max(minWidth, prev - delta))
            }
          />
        )}

        {/* Right: Editor */}
        {editingNodeId && (
          <div
            style={{
              width: rightWidth,
              minWidth: 50,
              background: "#fff",
              borderLeft: "1px solid #ddd",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Text strong>属性配置</Text>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => setEditingNodeId(null)}
              />
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              <div style={{ minWidth: 300 }}>
                {currentEditNode && (
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveNode}
                    size="small"
                  >
                    <Card
                      size="small"
                      title="基础信息"
                      style={{ marginBottom: 12 }}
                    >
                      <Form.Item label="节点 ID" name="id">
                        <Input
                          disabled
                          style={{ fontSize: 11, color: "#888" }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="名称"
                        name="name"
                        rules={[{ required: true }]}
                      >
                        <Input placeholder="名称" />
                      </Form.Item>
                    </Card>
                    <Card
                      size="small"
                      title="流程"
                      style={{ marginBottom: 12 }}
                    >
                      <Form.Item name="targetNodeId" label="跳转至">
                        <Select
                          allowClear
                          showSearch
                          optionFilterProp="children"
                        >
                          {jumpTargets.map((n) => (
                            <Option key={n.id} value={n.id}>
                              <span
                                style={{
                                  color: "#1890ff",
                                  fontWeight: "bold",
                                  marginRight: 8,
                                }}
                              >
                                {n.computedCode}
                              </span>
                              {n.data.label || "(未命名)"}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Card>
                    <Card
                      size="small"
                      title="随路数据"
                      style={{ marginBottom: 12 }}
                    >
                      <div
                        style={{
                          background: "#fafafa",
                          padding: 8,
                          borderRadius: 4,
                          maxHeight: 120,
                          overflowY: "auto",
                          marginBottom: 8,
                          border: "1px solid #f0f0f0",
                        }}
                      >
                        {Object.entries(currentEditNode.aggregatedData).map(
                          ([k, v]) => (
                            <div
                              key={k}
                              style={{
                                fontSize: 10,
                                borderBottom: "1px dashed #eee",
                                padding: "2px 0",
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span style={{ color: "#1890ff" }}>{k}</span>
                              <span>{v}</span>
                            </div>
                          )
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Form.Item
                          name="payloadKey"
                          style={{ flex: 1, marginBottom: 0 }}
                        >
                          <Input placeholder="Key" />
                        </Form.Item>
                        <Form.Item
                          name="payloadValue"
                          style={{ flex: 1, marginBottom: 0 }}
                        >
                          <Input placeholder="Value" />
                        </Form.Item>
                      </div>
                    </Card>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        block
                      >
                        保存
                      </Button>
                      <Button
                        icon={<FileTextOutlined />}
                        block
                        onClick={handleSaveDraft}
                        style={{
                          borderStyle: "dashed",
                          borderColor: "#faad14",
                          color: "#faad14",
                        }}
                      >
                        草稿
                      </Button>
                    </Space>
                  </Form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 修复：给组件Props加默认值 rfNodes = [], rfEdges = [], layoutDeps = []
const ReactFlowWrapper = ({
  rfNodes = [],
  rfEdges = [],
  setRfInstance,
  handleNodeSelect,
  layoutDeps = [],
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

export default SOPEditorLayout;
