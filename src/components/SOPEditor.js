import React, { useState, useMemo, useEffect } from "react";
import {
  Tree,
  Button,
  message,
  Tag,
  Form,
  Typography,
  Modal,
  Radio,
  Tooltip,
  Empty,
  Input,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  CloudSyncOutlined,
  ReloadOutlined,
  FileTextOutlined,
  PartitionOutlined,
  AimOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { v4 as uuidv4 } from "uuid";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

import { processGraphData, buildTreeData } from "../utils/graphLogic";
import Resizer from "./Resizer";
import SOPCanvasView from "./SOPCanvasView";
import SOPTextView from "./SOPTextView";
import PropertyPanel from "./PropertyPanel";
import FloatingWatermark from "./FloatingWatermark";

const { Text } = Typography;

// --- 独立出来的编辑器组件 ---
const SOPEditor = ({ user, projectId, onBack }) => {
  const [form] = Form.useForm();

  const [viewMode, setViewMode] = useState("canvas");
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const minWidth = 200;

  const [flowMeta, setFlowMeta] = useState({ id: uuidv4(), name: "加载中..." });
  const [sopData, setSopData] = useState({ nodes: [], edges: [] });

  const [editingNodeId, setEditingNodeId] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(["root"]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  // 1. 初始化加载
  useEffect(() => {
    if (!projectId) return;

    const initLoad = async () => {
      try {
        message.loading({ content: "加载项目数据...", key: "initLoad" });
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.nodes)
            setSopData({ nodes: data.nodes, edges: data.edges || [] });
          if (data.meta) setFlowMeta(data.meta);
          message.success({ content: "加载完成", key: "initLoad" });
        } else {
          // 如果是新项目ID（新建流程），则初始化默认数据
          setFlowMeta({ id: projectId, name: "未命名新流程" });
          setSopData({ nodes: [], edges: [] });
          message.success({ content: "已初始化新项目", key: "initLoad" });
        }
      } catch (error) {
        console.error(error);
        message.error("加载失败，请检查网络");
      }
    };
    initLoad();
  }, [projectId]);

  // 计算逻辑
  const allNodesWithCode = useMemo(
    () => processGraphData(sopData.nodes, sopData.edges, new Set()),
    [sopData]
  );
  const visibleNodesForCanvas = useMemo(
    () => processGraphData(sopData.nodes, sopData.edges, collapsedNodeIds),
    [sopData, collapsedNodeIds]
  );
  const treeData = useMemo(
    () => buildTreeData(allNodesWithCode, sopData.edges),
    [allNodesWithCode, sopData.edges]
  );

  // Actions
  const handleCreateRoot = () => {
    const rootId = "root";
    const newRoot = {
      id: rootId,
      type: "input",
      position: { x: 0, y: 0 },
      data: { label: "开始", description: "流程起点", payload: {} },
    };
    setSopData({ nodes: [newRoot], edges: [] });
    setEditingNodeId(rootId);
    setExpandedKeys([rootId]);
  };

  const toggleNodeCollapse = (nodeId) => {
    const newSet = new Set(collapsedNodeIds);
    newSet.has(nodeId) ? newSet.delete(nodeId) : newSet.add(nodeId);
    setCollapsedNodeIds(newSet);
  };

  const onTreeDrop = (info) => {
    // ... 保留原来的拖拽逻辑，太长了，这里省略，请务必把原逻辑复制过来 ...
    // 如果你之前的逻辑还在 App.js，直接把 onTreeDrop 整个函数拷过来
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    // (简写示意，请替换为完整逻辑)
    if (dragKey === "root") return;
    // ...完整逻辑...
    message.success("结构调整成功(演示)");
  };

  // 简化的 addBranch/deleteNode (请用你原来的完整代码)
  const addBranch = (parentId) => {
    const newNodeId = uuidv4();
    const newNode = {
      id: newNodeId,
      position: { x: 0, y: 0 },
      data: { label: "新节点", description: "", payload: {} },
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
    setExpandedKeys((prev) => [...prev, parentId]);
  };

  const deleteNode = (nodeId) => {
    if (nodeId === "root") return;
    setSopData((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
    }));
    setEditingNodeId(null);
  };

  const handleNodeSelect = (nodeId) => {
    setEditingNodeId(nodeId);
    const node = sopData.nodes.find((n) => n.id === nodeId);
    if (node) {
      form.resetFields();
      form.setFieldsValue({
        id: node.id,
        name: node.data.label,
        description: node.data.description,
        jumpTargetId: node.data.jumpTargetId,
        flowName: flowMeta.name,
      });
    }
  };

  const updateNodeData = (values) => {
    const currentNode = sopData.nodes.find((n) => n.id === editingNodeId);
    const updatedPayload = values.payloadKey
      ? {
          ...currentNode?.data.payload,
          [values.payloadKey]: values.payloadValue,
        }
      : currentNode?.data.payload;
    setSopData((prev) => ({
      nodes: prev.nodes.map((n) =>
        n.id === editingNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: values.name,
                description: values.description,
                jumpTargetId: values.jumpTargetId,
                payload: updatedPayload,
              },
            }
          : n
      ),
      edges: prev.edges,
    }));
  };

  // --- 保存逻辑 (带权限) ---
  const handleGlobalSave = async () => {
    if (sopData.nodes.length === 0) return message.warning("无内容");

    // 清洗 undefined
    const cleanNodes = JSON.parse(JSON.stringify(sopData.nodes));
    const cleanEdges = JSON.parse(JSON.stringify(sopData.edges));

    const saveData = {
      meta: flowMeta,
      nodes: cleanNodes,
      edges: cleanEdges,
      updatedAt: new Date().toISOString(),
      // 关键：保存拥有者信息
      ownerId: user.uid,
      ownerEmail: user.email,
      // 如果是管理员修改别人的，这里逻辑以后可以细化，暂时简单覆盖
    };

    try {
      message.loading({ content: "保存中...", key: "save" });
      await setDoc(doc(db, "projects", projectId), saveData, { merge: true });
      message.success({ content: "保存成功", key: "save" });
    } catch (err) {
      message.error("保存失败: " + err.message);
    }
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
      <FloatingWatermark />

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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ marginRight: 8 }}
          >
            返回列表
          </Button>
          <AppstoreOutlined
            style={{ fontSize: 18, color: "#1890ff", marginRight: 12 }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Input
              value={flowMeta.name}
              onChange={(e) =>
                setFlowMeta((prev) => ({ ...prev, name: e.target.value }))
              }
              bordered={false}
              style={{ fontWeight: 600, padding: 0 }}
            />
            <Text type="secondary" style={{ fontSize: 10 }}>
              ID: {projectId}
            </Text>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<CloudSyncOutlined />}
            onClick={handleGlobalSave}
          >
            保存
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Tree */}
        <div
          style={{
            width: leftWidth,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #f0f0f0",
          }}
        >
          <div style={{ padding: "10px", background: "#fafafa" }}>目录</div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {sopData.nodes.length === 0 ? (
              <Button
                icon={<PlusOutlined />}
                onClick={handleCreateRoot}
                type="dashed"
                block
              >
                创建根节点
              </Button>
            ) : (
              <Tree
                treeData={treeData}
                expandedKeys={expandedKeys}
                onExpand={setExpandedKeys}
                selectedKeys={[editingNodeId]}
                onSelect={([key]) => handleNodeSelect(key)}
                draggable
                onDrop={onTreeDrop}
                blockNode
                // 这里为了代码短，省略了 titleRender 的复杂逻辑，请务必把之前的 titleRender 拷过来
                titleRender={(node) => <span>{node.title}</span>}
              />
            )}
          </div>
        </div>
        <Resizer
          onResize={(d) => setLeftWidth((p) => Math.max(minWidth, p + d))}
        />

        {/* Center Canvas */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* 视图切换按钮等... (请保留原逻辑) */}
          <div style={{ flex: 1 }}>
            {viewMode === "canvas" ? (
              <SOPCanvasView
                sopData={sopData}
                visibleNodes={visibleNodesForCanvas}
                allNodesWithCode={allNodesWithCode}
                collapsedNodeIds={collapsedNodeIds}
                editingNodeId={editingNodeId}
                setRfInstance={setRfInstance}
                handleNodeSelect={handleNodeSelect}
                toggleNodeCollapse={toggleNodeCollapse}
                layoutDeps={[
                  leftWidth,
                  rightWidth,
                  editingNodeId,
                  expandedKeys,
                  collapsedNodeIds,
                ]}
              />
            ) : (
              <SOPTextView
                nodes={allNodesWithCode}
                edges={sopData.edges}
                flowMeta={flowMeta}
                selectedId={editingNodeId}
                onSelect={handleNodeSelect}
                collapsedNodeIds={collapsedNodeIds}
                toggleNodeCollapse={toggleNodeCollapse}
              />
            )}
          </div>
        </div>

        {/* Right Property */}
        {editingNodeId && (
          <>
            <Resizer
              onResize={(d) => setRightWidth((p) => Math.max(minWidth, p - d))}
            />
            <div
              style={{
                width: rightWidth,
                background: "#fff",
                borderLeft: "1px solid #ddd",
              }}
            >
              <PropertyPanel
                form={form}
                currentEditNode={currentEditNode}
                jumpTargets={jumpTargets}
                onSaveNode={(vals) => {
                  updateNodeData(vals);
                  message.success("已更新缓存");
                }}
                onClose={() => setEditingNodeId(null)}
                flowMeta={flowMeta}
                onUpdateFlowMeta={(m) => setFlowMeta((p) => ({ ...p, ...m }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SOPEditor;
