import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Tree,
  Button,
  message,
  Tag,
  Form,
  Typography,
  Modal,
  Input,
  Spin,
} from "antd";
import {
  PlusOutlined,
  AppstoreOutlined,
  CloudSyncOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
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

const SOPEditor = ({ user, projectId, onBack }) => {
  const [form] = Form.useForm();

  const [viewMode, setViewMode] = useState("canvas");
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const minWidth = 200;

  const [flowMeta, setFlowMeta] = useState({ id: uuidv4(), name: "加载中..." });
  const [sopData, setSopData] = useState({ nodes: [], edges: [] });

  // --- 自动保存状态 ---
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'error'
  const [lastSaveTime, setLastSaveTime] = useState(null);

  // --- 关键：使用 Ref 解决定时器闭包问题 ---
  // 定时器里读不到最新的 state，必须通过 Ref 来穿透
  const sopDataRef = useRef(sopData);
  const flowMetaRef = useRef(flowMeta);

  // 每次 state 更新，同步更新 ref
  useEffect(() => {
    sopDataRef.current = sopData;
  }, [sopData]);
  useEffect(() => {
    flowMetaRef.current = flowMeta;
  }, [flowMeta]);

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

  // 2. --- 核心：每隔 5 秒自动保存 ---
  useEffect(() => {
    const timer = setInterval(async () => {
      // 调用保存逻辑，传入 true 表示是自动保存
      await handleGlobalSave(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [projectId, user]); // 依赖项里不需要 sopData，因为我们用了 Ref

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
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split("-");
    if (dragKey === "root") return message.warning("根节点不可移动");
    if (dropKey === "root" && info.dropToGap)
      return message.warning("根节点必须唯一");

    let newEdges = sopData.edges.filter((e) => e.target !== dragKey);
    let newParentId;
    let insertIndex;

    if (!info.dropToGap) {
      newParentId = dropKey;
      const siblingEdges = newEdges.filter((e) => e.source === newParentId);
      insertIndex = siblingEdges.length;
    } else {
      const dropTargetEdge = sopData.edges.find((e) => e.target === dropKey);
      if (!dropTargetEdge) return;
      newParentId = dropTargetEdge.source;
      const siblingEdges = newEdges.filter((e) => e.source === newParentId);
      const dropTargetIndex = siblingEdges.findIndex(
        (e) => e.target === dropKey
      );
      insertIndex =
        info.dropPosition - Number(dropPos[dropPos.length - 1]) === -1
          ? dropTargetIndex
          : dropTargetIndex + 1;
    }

    const newEdge = {
      id: `e${newParentId}-${dragKey}-${uuidv4()}`,
      source: newParentId,
      target: dragKey,
    };
    const otherEdges = newEdges.filter((e) => e.source !== newParentId);
    const currentSiblingEdges = newEdges.filter(
      (e) => e.source === newParentId
    );
    currentSiblingEdges.splice(insertIndex, 0, newEdge);
    const finalEdges = [...otherEdges, ...currentSiblingEdges];
    setSopData((prev) => ({ ...prev, edges: finalEdges }));
  };

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

  // --- 保存逻辑 (支持自动保存) ---
  const handleGlobalSave = async (isAutoSave = false) => {
    // 1. 获取最新数据 (如果是自动保存，从 Ref 拿；如果是手动点击，从 State 拿也可以，但 Ref 更稳)
    const currentNodes = isAutoSave ? sopDataRef.current.nodes : sopData.nodes;
    const currentEdges = isAutoSave ? sopDataRef.current.edges : sopData.edges;
    const currentMeta = isAutoSave ? flowMetaRef.current : flowMeta;

    // 自动保存时，如果为空，也允许保存（覆盖云端为空），但通常不报错
    // 手动保存时，如果为空，提示用户
    if (!isAutoSave && currentNodes.length === 0)
      return message.warning("无内容可保存");

    // 2. 清洗 undefined
    const cleanNodes = JSON.parse(JSON.stringify(currentNodes));
    const cleanEdges = JSON.parse(JSON.stringify(currentEdges));

    const saveData = {
      meta: currentMeta,
      nodes: cleanNodes,
      edges: cleanEdges,
      updatedAt: new Date().toISOString(),
      ownerId: user.uid,
      ownerEmail: user.email,
    };

    try {
      if (!isAutoSave) {
        message.loading({ content: "保存中...", key: "save" });
      } else {
        setSaveStatus("saving"); // 自动保存状态
      }

      await setDoc(doc(db, "projects", projectId), saveData, { merge: true });

      if (!isAutoSave) {
        message.success({ content: "保存成功", key: "save" });
      } else {
        // 自动保存成功，更新状态和时间
        setSaveStatus("saved");
        setLastSaveTime(new Date());
      }
    } catch (err) {
      console.error(err);
      if (!isAutoSave) {
        message.error("保存失败: " + err.message);
      } else {
        setSaveStatus("error");
      }
    }
  };

  const currentEditNode = allNodesWithCode.find((n) => n.id === editingNodeId);
  const jumpTargets = allNodesWithCode.filter((n) => n.id !== editingNodeId);

  // --- 自动保存状态显示组件 ---
  const renderSaveStatus = () => {
    if (saveStatus === "saving") {
      return (
        <Tag icon={<LoadingOutlined />} color="processing">
          自动保存中...
        </Tag>
      );
    }
    if (saveStatus === "error") {
      return <Tag color="error">自动保存失败</Tag>;
    }
    if (lastSaveTime) {
      const timeStr = lastSaveTime.toLocaleTimeString();
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <CheckCircleOutlined /> 已自动保存 {timeStr}
        </Text>
      );
    }
    return null;
  };

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
            返回
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Text type="secondary" style={{ fontSize: 10 }}>
                ID: {projectId.slice(0, 6)}...
              </Text>
              {/* 显示自动保存状态 */}
              {renderSaveStatus()}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<CloudSyncOutlined />}
            onClick={() => handleGlobalSave(false)}
          >
            手动保存
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
                titleRender={(node) => (
                  // 简略版，实际请用你之前完整的 titleRender 逻辑
                  <span>{node.title}</span>
                )}
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
