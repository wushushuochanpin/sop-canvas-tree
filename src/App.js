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
  SaveOutlined,
  UploadOutlined,
  ReloadOutlined,
  FileTextOutlined,
  PartitionOutlined,
  AimOutlined, // 【已修复】原代码漏掉了这个图标的引入
} from "@ant-design/icons";
import { v4 as uuidv4 } from "uuid";

import { processGraphData, buildTreeData } from "./utils/graphLogic";
import Resizer from "./components/Resizer";
import SOPCanvasView from "./components/SOPCanvasView";
import SOPTextView from "./components/SOPTextView";
import PropertyPanel from "./components/PropertyPanel";
// 【新增】引入水印组件
import FloatingWatermark from "./components/FloatingWatermark";

const { Text } = Typography;

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
  const fileInputRef = useRef(null);

  const [viewMode, setViewMode] = useState("canvas");
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(360);
  const minWidth = 200;

  // --- 全局流程元数据 ---
  const [flowMeta, setFlowMeta] = useState({
    id: uuidv4(),
    name: generateDefaultName(),
  });

  // --- 业务数据 ---
  const [sopData, setSopData] = useState({
    nodes: [],
    edges: [],
  });

  const [editingNodeId, setEditingNodeId] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(["root"]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  // 走马灯
  useEffect(() => {
    const text = "SOP 流程编排系统 - 专业的逻辑设计工具      ";
    let currentText = text;
    const timer = setInterval(() => {
      const firstChar = currentText.charAt(0);
      const restText = currentText.substring(1);
      currentText = restText + firstChar;
      document.title = currentText;
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // --- 计算逻辑 ---
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

  // --- Actions ---

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

  const toggleNodeCollapse = (nodeId) => {
    const newSet = new Set(collapsedNodeIds);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    setCollapsedNodeIds(newSet);
  };

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

  const handleNodeSelect = (nodeId) => {
    setEditingNodeId(nodeId);
    const node = sopData.nodes.find((n) => n.id === nodeId);
    if (node) {
      form.resetFields();
      form.setFieldsValue({
        id: node.id,
        name: node.data.label,
        description: node.data.description,
        flowName: flowMeta.name,
      });
    }
  };

  const handleSaveNode = (values) => {
    updateNodeData(values);
    message.success("节点配置已保存");
  };

  // --- 全局保存核心逻辑 (增强版) ---
  const handleGlobalSave = async () => {
    if (sopData.nodes.length === 0) {
      message.warning("没有内容可保存");
      return;
    }
    const exportData = {
      meta: flowMeta,
      ...sopData,
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    // 过滤非法字符，确保文件名合法
    const safeName = flowMeta.name.replace(/[<>:"/\\|?*]+/g, "_");
    const fileName = `${safeName}.json`;

    try {
      // 尝试使用文件系统 API (Chrome/Edge 支持)
      if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "SOP Flow JSON",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(dataStr);
        await writable.close();
        message.success("文件已成功保存到本地");
      } else {
        throw new Error("API_NOT_SUPPORTED");
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (err.message === "API_NOT_SUPPORTED") {
        message.info("当前浏览器环境不支持选择路径，已自动下载");
      } else {
        message.success("文件已导出");
      }
    }
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
                description: values.description,
                payload: updatedPayload,
              },
            }
          : n
      ),
      edges: prev.edges,
    }));
  };

  const handleUpdateFlowMeta = (newMeta) => {
    setFlowMeta((prev) => ({ ...prev, ...newMeta }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json && Array.isArray(json.nodes)) {
          if (json.meta) setFlowMeta(json.meta);
          setSopData({ nodes: json.nodes, edges: json.edges });
          setEditingNodeId(null);
          setExpandedKeys(["root"]);
          setCollapsedNodeIds(new Set());
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
      content: "将清空当前所有内容。",
      onOk: () => {
        setFlowMeta({ id: uuidv4(), name: generateDefaultName() });
        setSopData({ nodes: [], edges: [] });
        setEditingNodeId(null);
        setCollapsedNodeIds(new Set());
        message.success("已重置");
      },
    });
  };

  const currentEditNode = allNodesWithCode.find((n) => n.id === editingNodeId);
  const jumpTargets = allNodesWithCode.filter((n) => n.id !== editingNodeId);

  const handleJumpTo = () => {};

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative", // 确保子元素定位基于此
      }}
    >
      {/* 【新增】 放入水印组件 */}
      <FloatingWatermark />

      <style>{`
        .ant-tree.ant-tree-show-line .ant-tree-indent-unit::before {
          border-left: 1px dashed #d9d9d9 !important;
        }
        .ant-tree.ant-tree-show-line .ant-tree-switcher-line-icon {
          color: #d9d9d9 !important;
        }
        .header-flow-name-input {
            font-size: 16px; font-weight: 600; color: #1f1f1f; padding: 0; transition: all 0.3s;
        }
        .header-flow-name-input:hover, .header-flow-name-input:focus {
            background: #fafafa; padding: 0 8px;
        }
      `}</style>

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            marginRight: 20,
          }}
        >
          <AppstoreOutlined
            style={{ fontSize: 18, color: "#1890ff", marginRight: 12 }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              maxWidth: 400,
            }}
          >
            <Input
              value={flowMeta.name}
              onChange={(e) => handleUpdateFlowMeta({ name: e.target.value })}
              bordered={false}
              className="header-flow-name-input"
              placeholder="输入流程名称"
            />
            <Text
              type="secondary"
              style={{ fontSize: 10, lineHeight: 1, marginTop: 2 }}
            >
              ID: {flowMeta.id.slice(0, 8)}...
            </Text>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleGlobalSave}
          >
            保存文件
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
              {sopData.nodes.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center" }}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无节点"
                  />
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
                  onExpand={(keys) => setExpandedKeys(keys)}
                  onDrop={onTreeDrop}
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
                          <Tooltip title="存在跳转">
                            <AimOutlined
                              style={{
                                marginLeft: 4,
                                color: "#ccc",
                                fontSize: 12,
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
                  )}
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

        {/* Center: Main Area */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {sopData.nodes.length > 0 ? (
            <>
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
              <div style={{ textAlign: "center" }}>
                <PartitionOutlined
                  style={{ fontSize: 48, marginBottom: 16, color: "#e0e0e0" }}
                />
                <div>请先在左侧目录创建流程</div>
              </div>
            </div>
          )}
        </div>

        {editingNodeId && (
          <Resizer
            onResize={(delta) =>
              setRightWidth((prev) => Math.max(minWidth, prev - delta))
            }
          />
        )}

        {/* Right: Property Panel */}
        {editingNodeId && (
          <div
            style={{
              width: rightWidth,
              minWidth: 50,
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
        )}
      </div>
    </div>
  );
};

export default SOPEditorLayout;
