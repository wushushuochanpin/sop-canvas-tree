import React, { useState, useMemo, useEffect, useRef } from "react";
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
  CloudSyncOutlined, // 云同步图标
  ReloadOutlined,
  FileTextOutlined,
  PartitionOutlined,
  AimOutlined,
} from "@ant-design/icons";
import { v4 as uuidv4 } from "uuid";

// --- Firebase 引入 ---
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase"; // 确保 src/firebase.js 存在且配置正确

import { processGraphData, buildTreeData } from "./utils/graphLogic";
import Resizer from "./components/Resizer";
import SOPCanvasView from "./components/SOPCanvasView";
import SOPTextView from "./components/SOPTextView";
import PropertyPanel from "./components/PropertyPanel";
import FloatingWatermark from "./components/FloatingWatermark";

const { Text } = Typography;

// --- 常量定义 ---
// 在数据库中存储的文档ID。你可以改成其他字符串，或者从URL参数获取
const PROJECT_DOC_ID = "sop_demo_project_001";

// 生成默认流程名称
const generateDefaultName = () => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}年${
    date.getMonth() + 1
  }月${date.getDate()}日`;
  return `新流程 ${dateStr}`;
};

const SOPEditorLayout = () => {
  const [form] = Form.useForm();

  // 视图状态
  const [viewMode, setViewMode] = useState("canvas"); // 'canvas' | 'text'
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const minWidth = 200;

  // --- 全局流程元数据 ---
  const [flowMeta, setFlowMeta] = useState({
    id: uuidv4(),
    name: generateDefaultName(),
  });

  // --- 业务数据 (核心) ---
  const [sopData, setSopData] = useState({
    nodes: [],
    edges: [],
  });

  // --- UI 交互状态 ---
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(["root"]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  // 1. 【初始化】页面加载时，从 Firebase 读取数据
  useEffect(() => {
    const initLoad = async () => {
      try {
        message.loading({ content: "正在同步云端数据...", key: "initLoad" });
        const docRef = doc(db, "projects", PROJECT_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // 恢复数据
          if (data.nodes)
            setSopData({ nodes: data.nodes, edges: data.edges || [] });
          if (data.meta) setFlowMeta(data.meta);
          message.success({ content: "云端数据同步完成", key: "initLoad" });
        } else {
          message.info({
            content: "云端暂无数据，请点击保存创建",
            key: "initLoad",
          });
        }
      } catch (error) {
        console.error("加载失败:", error);
        message.error({
          content: "读取失败，请检查网络或 Firebase 配置",
          key: "initLoad",
        });
      }
    };

    initLoad();
  }, []);

  // 2. 浏览器标题走马灯 (保持原有趣味性)
  useEffect(() => {
    const text = "SOP 流程编排系统 - Design by zhangjunxu      ";
    let currentText = text;
    const timer = setInterval(() => {
      const firstChar = currentText.charAt(0);
      const restText = currentText.substring(1);
      currentText = restText + firstChar;
      document.title = currentText;
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // --- 计算逻辑 (Memo) ---
  const allNodesWithCode = useMemo(() => {
    return processGraphData(sopData.nodes, sopData.edges, new Set());
  }, [sopData]);

  const visibleNodesForCanvas = useMemo(() => {
    return processGraphData(sopData.nodes, sopData.edges, collapsedNodeIds);
  }, [sopData, collapsedNodeIds]);

  const treeData = useMemo(
    () => buildTreeData(allNodesWithCode, sopData.edges),
    [allNodesWithCode, sopData.edges]
  );

  // --- 核心 Actions ---

  // 创建根节点
  const handleCreateRoot = () => {
    const rootId = "root";
    const newRoot = {
      id: rootId,
      position: { x: 0, y: 0 },
      data: {
        label: "开始",
        description: "流程起始点",
        payload: {},
      },
      type: "input",
    };
    setSopData({ nodes: [newRoot], edges: [] });
    setEditingNodeId(rootId);
    setExpandedKeys([rootId]);
    message.success("已创建流程起点");
  };

  // 切换折叠
  const toggleNodeCollapse = (nodeId) => {
    const newSet = new Set(collapsedNodeIds);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    setCollapsedNodeIds(newSet);
  };

  // 目录树拖拽排序逻辑 (核心难点)
  const onTreeDrop = (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split("-");

    if (dragKey === "root") {
      message.warning("根节点不可移动");
      return;
    }
    if (dropKey === "root" && info.dropToGap) {
      message.warning("根节点必须唯一");
      return;
    }

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
    message.success("结构调整成功");
  };

  // 新增子节点
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
    if (!expandedKeys.includes(parentId)) {
      setExpandedKeys((prev) => [...prev, parentId]);
    }
    handleNodeSelect(newNodeId);
  };

  // 删除节点
  const deleteNode = (nodeId) => {
    if (nodeId === "root") {
      message.warning("根节点不可删除");
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

  // 选中节点
  const handleNodeSelect = (nodeId) => {
    setEditingNodeId(nodeId);
    const node = sopData.nodes.find((n) => n.id === nodeId);
    if (node) {
      form.resetFields();
      form.setFieldsValue({
        id: node.id,
        name: node.data.label,
        description: node.data.description,
        jumpTargetId: node.data.jumpTargetId, // 回显跳转
        flowName: flowMeta.name,
      });
    }
  };

  // 更新节点数据 (包含跳转逻辑)
  const updateNodeData = (values) => {
    const currentNode = sopData.nodes.find((n) => n.id === editingNodeId);
    const currentPayload = currentNode?.data.payload || {};
    // 合并随路数据
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
                description: values.description,
                jumpTargetId: values.jumpTargetId, // 保存跳转目标
                payload: updatedPayload,
              },
            }
          : n
      ),
      edges: prev.edges,
    }));
  };

  const handleSaveNode = (values) => {
    updateNodeData(values);
    message.success("节点配置已更新 (请记得点击云端保存)");
  };

  // --- 【核心修改】保存到 Firebase ---
  const handleGlobalSave = async () => {
    if (sopData.nodes.length === 0) {
      message.warning("没有内容可保存");
      return;
    }

    const saveData = {
      meta: flowMeta,
      nodes: sopData.nodes,
      edges: sopData.edges,
      updatedAt: new Date().toISOString(),
    };

    try {
      message.loading({ content: "正在保存到云端...", key: "saveMsg" });

      // 写入 Firestore: 集合 "projects", 文档 PROJECT_DOC_ID
      await setDoc(doc(db, "projects", PROJECT_DOC_ID), saveData);

      message.success({
        content: "保存成功！数据已同步到云端",
        key: "saveMsg",
      });
    } catch (err) {
      console.error(err);
      message.error({ content: "保存失败: " + err.message, key: "saveMsg" });
    }
  };

  // 更新流程元数据
  const handleUpdateFlowMeta = (newMeta) => {
    setFlowMeta((prev) => ({ ...prev, ...newMeta }));
  };

  // 重置画布
  const handleResetData = () => {
    Modal.confirm({
      title: "确认清空？",
      content: "将清空当前画布所有内容（云端数据不会删除，除非再次保存）。",
      onOk: () => {
        setFlowMeta({ id: uuidv4(), name: generateDefaultName() });
        setSopData({ nodes: [], edges: [] });
        setEditingNodeId(null);
        setCollapsedNodeIds(new Set());
      },
    });
  };

  // 辅助变量
  const currentEditNode = allNodesWithCode.find((n) => n.id === editingNodeId);
  // 可跳转的目标列表 (排除自己)
  const jumpTargets = allNodesWithCode.filter((n) => n.id !== editingNodeId);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 1. 漂浮水印 */}
      <FloatingWatermark />

      {/* CSS 样式修正 */}
      <style>{`
        .ant-tree.ant-tree-show-line .ant-tree-indent-unit::before {
          border-left: 1px dashed #d9d9d9 !important;
        }
        .header-flow-name-input {
            font-size: 16px; font-weight: 600; color: #1f1f1f; padding: 0; transition: all 0.3s;
        }
        .header-flow-name-input:hover, .header-flow-name-input:focus {
            background: #fafafa; padding: 0 8px;
        }
      `}</style>

      {/* 2. 顶部 Header */}
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
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <AppstoreOutlined
            style={{ fontSize: 18, color: "#1890ff", marginRight: 12 }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Input
              value={flowMeta.name}
              onChange={(e) => handleUpdateFlowMeta({ name: e.target.value })}
              bordered={false}
              className="header-flow-name-input"
              placeholder="输入流程名称"
            />
            <Text type="secondary" style={{ fontSize: 10, lineHeight: 1 }}>
              ID: {flowMeta.id.slice(0, 8)}... (云同步)
            </Text>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<CloudSyncOutlined />}
            onClick={handleGlobalSave}
          >
            保存到云端
          </Button>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleResetData}
            title="重置画布"
          />
        </div>
      </div>

      {/* 3. 主体布局 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* 左侧: 目录树 */}
        <div
          style={{
            width: leftWidth,
            minWidth: 50,
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRight: "1px solid #f0f0f0",
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
              {sopData.nodes.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <Empty description="暂无节点" />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreateRoot}
                    style={{ marginTop: 16 }}
                  >
                    新建流程
                  </Button>
                </div>
              ) : (
                <Tree
                  className="draggable-tree"
                  draggable
                  blockNode
                  showLine={{ showLeafIcon: false }}
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onDrop={onTreeDrop}
                  treeData={treeData}
                  selectedKeys={[editingNodeId]}
                  titleRender={(nodeData) => {
                    // 动态查找跳转目标名称
                    const nodeItem = allNodesWithCode.find(
                      (n) => n.id === nodeData.key
                    );
                    const targetId = nodeItem?.data?.jumpTargetId;
                    const targetNode = targetId
                      ? allNodesWithCode.find((n) => n.id === targetId)
                      : null;
                    const jumpTooltip = targetNode
                      ? `跳转至: [${targetNode.code}] ${targetNode.data.label}`
                      : "跳转目标配置错误";

                    return (
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
                            }}
                          >
                            {nodeData.code}
                          </Tag>
                          <span>{nodeData.title}</span>
                          {targetId && (
                            <Tooltip title={jumpTooltip}>
                              <AimOutlined
                                style={{
                                  marginLeft: 6,
                                  color: "#faad14",
                                  fontSize: 12,
                                  cursor: "default",
                                }}
                              />
                            </Tooltip>
                          )}
                        </span>
                        <span onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined style={{ fontSize: 12 }} />}
                            onClick={() => addBranch(nodeData.key)}
                          />
                          {nodeData.key !== "root" && (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                              onClick={() => deleteNode(nodeData.key)}
                            />
                          )}
                        </span>
                      </div>
                    );
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <Resizer
          onResize={(delta) =>
            setLeftWidth((prev) => Math.max(minWidth, prev + delta))
          }
        />

        {/* 中间: 画布/文档视图 */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {sopData.nodes.length > 0 ? (
            <>
              {/* 视图切换按钮 */}
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 100,
                  background: "#fff",
                  padding: 4,
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <Radio.Group
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="canvas">
                    <AppstoreOutlined /> 画布
                  </Radio.Button>
                  <Radio.Button value="text">
                    <FileTextOutlined /> 文档
                  </Radio.Button>
                </Radio.Group>
              </div>

              <div style={{ flex: 1, position: "relative" }}>
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
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#999",
              }}
            >
              <PartitionOutlined
                style={{ fontSize: 48, marginBottom: 16, color: "#e0e0e0" }}
              />
            </div>
          )}
        </div>

        {/* 右侧: 属性面板 */}
        {editingNodeId && (
          <>
            <Resizer
              onResize={(delta) =>
                setRightWidth((prev) => Math.max(minWidth, prev - delta))
              }
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
                onSaveNode={handleSaveNode}
                onGlobalSave={handleGlobalSave}
                onClose={() => setEditingNodeId(null)}
                flowMeta={flowMeta}
                onUpdateFlowMeta={handleUpdateFlowMeta}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SOPEditorLayout;
