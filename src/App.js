import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Tree,
  Button,
  message,
  Tag,
  Form,
  Typography,
  Modal,
  Radio, // 使用 Radio 替代 Segmented 兼容性更好
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  AimOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { v4 as uuidv4 } from "uuid";

// 引入本地组件
import { processGraphData, buildTreeData } from "./utils/graphLogic";
import Resizer from "./components/Resizer";
import SOPCanvasView from "./components/SOPCanvasView";
import SOPTextView from "./components/SOPTextView";
import PropertyPanel from "./components/PropertyPanel";

const { Title, Text } = Typography;

const SOPEditorLayout = () => {
  const [form] = Form.useForm();
  const fileInputRef = useRef(null);

  // 视图模式：canvas 或 text
  const [viewMode, setViewMode] = useState("canvas");

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
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());

  // 走马灯标题
  useEffect(() => {
    const text = "SOP 流程编排系统 - 专业的逻辑设计工具      ";
    let currentText = text;
    const timer = setInterval(() => {
      const firstChar = currentText.charAt(0);
      const restText = currentText.substring(1);
      currentText = restText + firstChar;
      document.title = currentText;
    }, 300);
    return () => {
      clearInterval(timer);
      document.title = "SOP 流程编排";
    };
  }, []);

  // 核心计算
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

  // Actions
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
    const dropPosition =
      info.dropPosition - Number(dropPos[dropPos.length - 1]);

    if (dragKey === sopData.nodes[0].id) {
      message.warning("根节点不可移动");
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

      if (dropPosition === -1) {
        insertIndex = dropTargetIndex;
      } else {
        insertIndex = dropTargetIndex + 1;
      }
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

    if (!expandedKeys.includes(parentId)) {
      setExpandedKeys((prev) => [...prev, parentId]);
    }
    handleNodeSelect(newNodeId);
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
    if (viewMode === "text") setViewMode("canvas");
    setTimeout(() => {
      if (!targetId || !rfInstance) return;
      handleNodeSelect(targetId);
      rfInstance.fitView({
        nodes: [{ id: targetId }],
        padding: 0.5,
        duration: 500,
      });
      message.info("已定位");
    }, 100);
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
          setExpandedKeys([]);
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
      {/* 注入 Tree 虚线样式 */}
      <style>{`
        .ant-tree.ant-tree-show-line .ant-tree-indent-unit::before {
          border-left: 1px dashed #d9d9d9 !important;
        }
        .ant-tree.ant-tree-show-line .ant-tree-switcher-line-icon {
          color: #d9d9d9 !important;
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
          {/* 视图切换条 */}
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

          {/* 视图内容 */}
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
                handleJumpTo={handleJumpTo}
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
                selectedId={editingNodeId}
                onSelect={handleNodeSelect}
              />
            )}
          </div>
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
              onSaveDraft={handleSaveDraft}
              onClose={() => setEditingNodeId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SOPEditorLayout;
