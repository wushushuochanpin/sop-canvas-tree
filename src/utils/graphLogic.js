import dagre from "dagre";
import { Position } from "reactflow";

// --- 布局参数 ---
export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 28;
export const RANK_SEP = 100;
export const NODE_SEP = 20;

// --- 布局算法 ---
export const getLayoutedElements = (nodes = [], edges = []) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

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

// --- 核心数据处理 ---
export const processGraphData = (nodes = [], edges = [], collapsedIds = new Set()) => {
  if (!Array.isArray(nodes)) return [];
  
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

  edges.forEach((edge) => {
    const parent = nodeMap.get(edge.source);
    const child = nodeMap.get(edge.target);
    if (parent && child) {
      parent.childrenIds.push(child.id);
      child.parentIds.push(parent.id);
    }
  });

  // 严谨逻辑：只有没有任何父级的才是 Root
  const roots = [];
  nodeMap.forEach((node) => {
    if (node.parentIds.length === 0) roots.push(node);
  });

  const visited = new Set();
  const visibleNodes = [];

  const traverse = (nodeId, codePrefix, parentData, isHidden) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (!node.computedCode) node.computedCode = codePrefix;

    const currentData = { ...parentData, ...node.data.payload };
    node.aggregatedData = { ...node.aggregatedData, ...currentData };

    if (!isHidden) {
      visibleNodes.push(node);
    }

    if (visited.has(nodeId + codePrefix)) return;
    visited.add(nodeId + codePrefix);

    const isChildrenHidden = isHidden || collapsedIds.has(nodeId);

    node.childrenIds.forEach((childId, index) => {
      let childCode;
      if (node.computedCode === "0") {
        // 根节点的直接子节点，序号从 1 开始 (1, 2, 3...)
        childCode = (index + 1).toString();
      } else {
        // 其他子节点 (1.1, 1.2...)
        childCode = `${node.computedCode}.${index + 1}`;
      }
      traverse(childId, childCode, node.aggregatedData, isChildrenHidden);
    });
  };

  roots.forEach((root) => {
    traverse(root.id, "0", {}, false);
  });

  return visibleNodes;
};

// --- Tree Data 构建 ---
export const buildTreeData = (nodes = [], edges = []) => {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));

  const getChildren = (parentId) => {
    return edges
      .filter((e) => e.source === parentId)
      .map((e) => nodeMap.get(e.target))
      .filter(Boolean);
  };

  const recursiveBuild = (node) => {
    const children = getChildren(node.id);
    return {
      key: node.id,
      title: node.data.label || "(未命名)",
      code: node.computedCode,
      jumpTo: node.data.jumpTargetId,
      children: children.map((child) => recursiveBuild(child)),
    };
  };

  // 只找真正的根节点
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