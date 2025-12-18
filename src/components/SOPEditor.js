import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Tree,
  Button,
  message,
  Tag,
  Form,
  Typography,
  Input,
  Tooltip,
  Radio,
  Empty,
  Switch, // 保留 Switch
  Space,
  Divider, // 用于分隔线
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  AimOutlined,
  FileTextOutlined,
  PartitionOutlined,
  SaveOutlined,
  HistoryOutlined,
  RocketOutlined,
  EditOutlined,
  DiffOutlined,
} from "@ant-design/icons";
import { v4 as uuidv4 } from "uuid";
import { doc, setDoc, getDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

import { processGraphData, buildTreeData } from "../utils/graphLogic";
import { generateChangeLog, hasContentChanged } from "../utils/diffLogic";
import {
  getNextPatchVersion,
  getNextMinorVersion,
  getNextMajorVersion,
  formatVersion,
  parseVersion,
} from "../utils/versionUtils";

import Resizer from "./Resizer";
import SOPCanvasView from "./SOPCanvasView";
import SOPTextView from "./SOPTextView";
import PropertyPanel from "./PropertyPanel";
import FloatingWatermark from "./FloatingWatermark";
import VersionHistoryModal from "./VersionHistoryModal";

const { Text } = Typography;

const SOPEditor = ({ user, projectId, onBack, onProjectChange }) => {
  const [form] = Form.useForm();

  // ============================
  // 1. 视图开关状态 (独立记忆)
  // ============================
  const [showCanvas, setShowCanvas] = useState(() => {
    const saved = localStorage.getItem("SOP_SHOW_CANVAS");
    return saved === null ? true : saved === "true";
  });

  const [showDoc, setShowDoc] = useState(() => {
    const saved = localStorage.getItem("SOP_SHOW_DOC");
    return saved === null ? true : saved === "true";
  });

  // 监听并保存
  useEffect(() => {
    localStorage.setItem("SOP_SHOW_CANVAS", showCanvas);
  }, [showCanvas]);
  useEffect(() => {
    localStorage.setItem("SOP_SHOW_DOC", showDoc);
  }, [showDoc]);

  // 计算中间区域是否可见
  const isCenterVisible = showCanvas || showDoc;

  // 计算实际渲染的视图模式
  // 如果双开 -> 使用 viewMode 状态
  // 如果单开 -> 强制对应视图
  const [viewMode, setViewMode] = useState("canvas"); // 内部状态只在双开时有效
  const effectiveViewMode =
    showCanvas && showDoc ? viewMode : showCanvas ? "canvas" : "text";

  // ============================
  // 2. 布局宽度状态 (带记忆)
  // ============================
  const [leftWidth, setLeftWidth] = useState(() => {
    const w = parseInt(localStorage.getItem("SOP_LEFT_WIDTH"));
    return !isNaN(w) && w > 0 ? w : 300;
  });

  const [rightWidth, setRightWidth] = useState(() => {
    const w = parseInt(localStorage.getItem("SOP_RIGHT_WIDTH"));
    return !isNaN(w) && w > 0 ? w : 360;
  });

  const minWidth = 200;

  useEffect(() => {
    localStorage.setItem("SOP_LEFT_WIDTH", leftWidth);
  }, [leftWidth]);
  useEffect(() => {
    localStorage.setItem("SOP_RIGHT_WIDTH", rightWidth);
  }, [rightWidth]);

  // ============================
  // 3. 核心数据与业务状态
  // ============================
  const [flowMeta, setFlowMeta] = useState({
    id: uuidv4(),
    name: "加载中...",
    latestVersion: "1.0.0",
  });
  const [sopData, setSopData] = useState({ nodes: [], edges: [] });

  const lastSavedRef = useRef(null);
  const [lastPublishedSnapshot, setLastPublishedSnapshot] = useState(null);

  const [saveStatus, setSaveStatus] = useState("saved");
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const sopDataRef = useRef(sopData);
  const flowMetaRef = useRef(flowMeta);

  useEffect(() => {
    sopDataRef.current = sopData;
  }, [sopData]);
  useEffect(() => {
    flowMetaRef.current = flowMeta;
  }, [flowMeta]);

  // --- 交互状态 ---
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(["root"]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState(new Set());
  const [rfInstance, setRfInstance] = useState(null); // ReactFlow 实例

  // ============================
  // 4. 初始化加载
  // ============================
  useEffect(() => {
    if (!projectId) return;
    const initLoad = async () => {
      try {
        message.loading({ content: "加载项目数据...", key: "initLoad" });
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedMeta = data.meta || {
            id: projectId,
            name: "未命名",
            latestVersion: "1.0.0",
          };
          loadedMeta.latestVersion = formatVersion(loadedMeta.latestVersion);

          const loadedNodes = data.nodes || [];
          const loadedEdges = data.edges || [];

          setSopData({ nodes: loadedNodes, edges: loadedEdges });
          setFlowMeta(loadedMeta);

          const snapshot = {
            nodes: loadedNodes,
            edges: loadedEdges,
            meta: loadedMeta,
          };
          lastSavedRef.current = snapshot;
          setLastPublishedSnapshot(snapshot);

          message.success({ content: "加载完成", key: "initLoad" });
        } else {
          const newMeta = {
            id: projectId,
            name: "未命名新流程",
            latestVersion: "1.0.0",
          };
          setFlowMeta(newMeta);
          setSopData({ nodes: [], edges: [] });

          const snapshot = { nodes: [], edges: [], meta: newMeta };
          lastSavedRef.current = snapshot;
          setLastPublishedSnapshot(snapshot);

          message.success({ content: "已初始化新项目", key: "initLoad" });
        }
      } catch (error) {
        console.error(error);
        message.error("加载失败，请检查网络");
      }
    };
    initLoad();
  }, [projectId]);

  // ============================
  // 5. 自动保存逻辑
  // ============================
  useEffect(() => {
    const timer = setInterval(async () => {
      const currentNodes = sopDataRef.current.nodes;
      const currentEdges = sopDataRef.current.edges;
      const currentMeta = flowMetaRef.current;

      if (!lastSavedRef.current || currentNodes.length === 0) return;

      const currentSnapshot = {
        nodes: currentNodes,
        edges: currentEdges,
        meta: currentMeta,
      };

      if (!hasContentChanged(lastSavedRef.current, currentSnapshot)) {
        return;
      }

      const cleanNodes = JSON.parse(JSON.stringify(currentNodes));
      const cleanEdges = JSON.parse(JSON.stringify(currentEdges));

      const nextVersion = getNextPatchVersion(currentMeta.latestVersion);

      const saveData = {
        meta: { ...currentMeta, latestVersion: nextVersion },
        nodes: cleanNodes,
        edges: cleanEdges,
        updatedAt: new Date().toISOString(),
        ownerId: user.uid,
        ownerEmail: user.email,
        status: "editing",
      };

      try {
        setSaveStatus("saving");
        await setDoc(doc(db, "projects", projectId), saveData, { merge: true });

        setFlowMeta((prev) => ({ ...prev, latestVersion: nextVersion }));
        lastSavedRef.current = {
          nodes: cleanNodes,
          edges: cleanEdges,
          meta: { ...currentMeta, latestVersion: nextVersion },
        };

        setSaveStatus("saved");
        setLastSaveTime(new Date());
      } catch (err) {
        setSaveStatus("error");
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [projectId, user]);

  // --- Memo计算 ---
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

  // --- Tree Actions ---
  const handleCreateRoot = () => {
    const rootId = "root";
    setSopData({
      nodes: [
        {
          id: rootId,
          type: "input",
          position: { x: 0, y: 0 },
          data: { label: "开始", description: "流程起点", payload: {} },
        },
      ],
      edges: [],
    });
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
    if (!expandedKeys.includes(parentId)) {
      setExpandedKeys((prev) => [...prev, parentId]);
    }
    handleNodeSelect(newNodeId);
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

  const handleNodeChange = (values) => {
    const currentNode = sopData.nodes.find((n) => n.id === editingNodeId);
    if (!currentNode) return;
    const updatedPayload = values.payloadKey
      ? {
          ...currentNode.data.payload,
          [values.payloadKey]: values.payloadValue,
        }
      : currentNode.data.payload;
    setSopData((prev) => ({
      nodes: prev.nodes.map((n) =>
        n.id === editingNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: values.name || n.data.label,
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

  const handleSaveTitle = async () => {
    if (!tempTitle || tempTitle.trim() === "")
      return message.warning("标题不能为空");
    if (tempTitle === flowMeta.name) {
      setIsEditingTitle(false);
      return;
    }
    const newMeta = { ...flowMeta, name: tempTitle };
    const currentNodes = sopDataRef.current.nodes;
    const currentEdges = sopDataRef.current.edges;

    const enrichedNodes = JSON.parse(JSON.stringify(currentNodes)).map((n) => {
      const found = allNodesWithCode.find((x) => x.id === n.id);
      return { ...n, computedCode: found?.computedCode };
    });

    const cleanEdges = JSON.parse(JSON.stringify(currentEdges));
    const newDataSnapshot = {
      nodes: enrichedNodes,
      edges: cleanEdges,
      meta: newMeta,
    };
    const changeLogs = generateChangeLog(
      lastPublishedSnapshot,
      newDataSnapshot
    );
    const nextVersion = getNextMinorVersion(flowMeta.latestVersion);

    try {
      message.loading({ content: "更新标题...", key: "saveTitle" });
      await addDoc(collection(db, "projects", projectId, "versions"), {
        versionStr: nextVersion,
        version: parseFloat(nextVersion.split(".").slice(0, 2).join(".")),
        type: "minor",
        nodes: enrichedNodes,
        edges: cleanEdges,
        meta: newMeta,
        changeLog: changeLogs,
        createdAt: new Date().toISOString(),
        editor: { uid: user.uid, name: user.displayName },
        remark: "更新流程标题",
      });
      await setDoc(
        doc(db, "projects", projectId),
        {
          meta: { ...newMeta, latestVersion: nextVersion },
          nodes: enrichedNodes,
          edges: cleanEdges,
          updatedAt: new Date().toISOString(),
          status: "editing",
        },
        { merge: true }
      );
      setFlowMeta((prev) => ({ ...newMeta, latestVersion: nextVersion }));
      setLastPublishedSnapshot(newDataSnapshot);
      lastSavedRef.current = newDataSnapshot;
      setIsEditingTitle(false);
      message.success({
        content: `标题更新成功 (v${nextVersion})`,
        key: "saveTitle",
      });
    } catch (e) {
      message.error("更新失败");
    }
  };

  const handleSaveDraft = async () => {
    const cleanNodes = JSON.parse(JSON.stringify(sopData.nodes));
    const cleanEdges = JSON.parse(JSON.stringify(sopData.edges));
    const currentMeta = flowMeta;

    const enrichedNodes = cleanNodes.map((n) => {
      const found = allNodesWithCode.find((x) => x.id === n.id);
      return { ...n, computedCode: found?.computedCode };
    });

    const newDataSnapshot = {
      nodes: enrichedNodes,
      edges: cleanEdges,
      meta: currentMeta,
    };
    if (!hasContentChanged(lastSavedRef.current, newDataSnapshot))
      return message.info("当前无变动");
    try {
      message.loading({ content: "保存草稿...", key: "save" });
      const nextVersion = getNextPatchVersion(currentMeta.latestVersion);
      const changeLogs = generateChangeLog(
        lastSavedRef.current,
        newDataSnapshot
      );
      await addDoc(collection(db, "projects", projectId, "versions"), {
        versionStr: nextVersion,
        version:
          parseFloat(nextVersion.split(".").slice(0, 2).join(".")) +
          parseInt(nextVersion.split(".")[2]) / 1000,
        type: "patch",
        nodes: enrichedNodes,
        edges: cleanEdges,
        meta: currentMeta,
        changeLog: changeLogs,
        createdAt: new Date().toISOString(),
        editor: { uid: user.uid, name: user.displayName },
        remark: "手动保存草稿",
      });
      await setDoc(
        doc(db, "projects", projectId),
        {
          nodes: cleanNodes,
          edges: cleanEdges,
          meta: { ...currentMeta, latestVersion: nextVersion },
          latestVersion: nextVersion,
          updatedAt: new Date().toISOString(),
          ownerId: user.uid,
          ownerEmail: user.email,
          status: "editing",
        },
        { merge: true }
      );
      setFlowMeta((prev) => ({ ...prev, latestVersion: nextVersion }));
      lastSavedRef.current = newDataSnapshot;
      message.success({ content: `草稿 v${nextVersion} 已保存`, key: "save" });
    } catch (err) {
      message.error("保存失败");
    }
  };

  const handleSaveMinor = async () => {
    const cleanNodes = JSON.parse(JSON.stringify(sopData.nodes));
    const cleanEdges = JSON.parse(JSON.stringify(sopData.edges));
    const enrichedNodes = cleanNodes.map((n) => {
      const found = allNodesWithCode.find((x) => x.id === n.id);
      return { ...n, computedCode: found?.computedCode };
    });

    const currentMeta = flowMeta;
    const newDataSnapshot = {
      nodes: enrichedNodes,
      edges: cleanEdges,
      meta: currentMeta,
    };
    const hasDiff = hasContentChanged(lastPublishedSnapshot, newDataSnapshot);
    const { patch } = parseVersion(currentMeta.latestVersion);
    if (!hasDiff && patch === 0) return message.info("无需存档");
    try {
      message.loading({ content: "存档中...", key: "save" });
      const nextVersion = getNextMinorVersion(currentMeta.latestVersion);
      let changeLogs = hasDiff
        ? generateChangeLog(lastPublishedSnapshot, newDataSnapshot)
        : [`归档草稿 (从 v${currentMeta.latestVersion})`];
      await addDoc(collection(db, "projects", projectId, "versions"), {
        versionStr: nextVersion,
        version: parseFloat(nextVersion.split(".").slice(0, 2).join(".")),
        type: "minor",
        nodes: enrichedNodes,
        edges: cleanEdges,
        meta: currentMeta,
        changeLog: changeLogs,
        createdAt: new Date().toISOString(),
        editor: { uid: user.uid, name: user.displayName },
        remark: "阶段性存档",
      });
      await setDoc(
        doc(db, "projects", projectId),
        {
          nodes: cleanNodes,
          edges: cleanEdges,
          meta: { ...currentMeta, latestVersion: nextVersion },
          latestVersion: nextVersion,
          updatedAt: new Date().toISOString(),
          status: "editing",
        },
        { merge: true }
      );
      setFlowMeta((prev) => ({ ...prev, latestVersion: nextVersion }));
      const finalSnapshot = {
        nodes: enrichedNodes,
        edges: cleanEdges,
        meta: { ...currentMeta, latestVersion: nextVersion },
      };
      setLastPublishedSnapshot(finalSnapshot);
      lastSavedRef.current = finalSnapshot;
      message.success({ content: `v${nextVersion} 存档成功`, key: "save" });
    } catch (e) {
      message.error("失败");
    }
  };

  const handleSaveMajor = async () => {
    const cleanNodes = JSON.parse(JSON.stringify(sopData.nodes));
    const cleanEdges = JSON.parse(JSON.stringify(sopData.edges));
    const enrichedNodes = cleanNodes.map((n) => {
      const found = allNodesWithCode.find((x) => x.id === n.id);
      return { ...n, computedCode: found?.computedCode };
    });

    const currentMeta = flowMeta;
    const newDataSnapshot = {
      nodes: enrichedNodes,
      edges: cleanEdges,
      meta: currentMeta,
    };
    const hasDiff = hasContentChanged(lastPublishedSnapshot, newDataSnapshot);
    const { minor, patch } = parseVersion(currentMeta.latestVersion);
    if (!hasDiff && minor === 0 && patch === 0)
      return message.warning("无需发布");
    try {
      message.loading({ content: "生成新版...", key: "save" });
      const nextVersion = getNextMajorVersion(currentMeta.latestVersion);
      const newProjectId = uuidv4();
      const newProjectData = {
        id: newProjectId,
        meta: { ...currentMeta, id: newProjectId, latestVersion: nextVersion },
        nodes: enrichedNodes,
        edges: cleanEdges,
        updatedAt: new Date().toISOString(),
        ownerId: user.uid,
        ownerEmail: user.email,
        status: "editing",
        latestVersion: nextVersion,
        forkedFrom: projectId,
      };
      await setDoc(doc(db, "projects", newProjectId), newProjectData);
      const changeLogs = hasDiff
        ? generateChangeLog(lastPublishedSnapshot, newDataSnapshot)
        : [`基于 v${currentMeta.latestVersion} 晋升`];
      await addDoc(collection(db, "projects", newProjectId, "versions"), {
        versionStr: nextVersion,
        version: parseFloat(nextVersion.split(".")[0]),
        type: "major",
        nodes: enrichedNodes,
        edges: cleanEdges,
        meta: newProjectData.meta,
        changeLog: changeLogs,
        createdAt: new Date().toISOString(),
        editor: { uid: user.uid, name: user.displayName },
        remark: `从 ${projectId} 裂变`,
      });
      message.success({
        content: `v${nextVersion} 生成成功，跳转中...`,
        key: "save",
        duration: 2,
      });
      if (onProjectChange)
        setTimeout(() => onProjectChange(newProjectId), 1000);
    } catch (e) {
      message.error("失败");
    }
  };

  const currentEditNode = allNodesWithCode.find((n) => n.id === editingNodeId);
  const jumpTargets = allNodesWithCode.filter((n) => n.id !== editingNodeId);

  const renderSaveStatus = () => {
    if (saveStatus === "saving")
      return (
        <Tag icon={<LoadingOutlined />} color="processing">
          自动保存...
        </Tag>
      );
    if (saveStatus === "error") return <Tag color="error">保存失败</Tag>;
    if (lastSaveTime)
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <CheckCircleOutlined /> {lastSaveTime.toLocaleTimeString()}
        </Text>
      );
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
          flexShrink: 0,
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
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isEditingTitle ? (
                <Input
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onPressEnter={handleSaveTitle}
                  style={{ width: 300 }}
                  suffix={
                    <Space size={4}>
                      <SaveOutlined
                        onClick={handleSaveTitle}
                        style={{ color: "#1890ff", cursor: "pointer" }}
                      />
                      <div
                        onClick={() => setIsEditingTitle(false)}
                        style={{ color: "#999", cursor: "pointer" }}
                      >
                        ×
                      </div>
                    </Space>
                  }
                  autoFocus
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text strong style={{ fontSize: 16 }}>
                    {flowMeta.name}
                  </Text>
                  <EditOutlined
                    style={{ color: "#999", cursor: "pointer", fontSize: 14 }}
                    onClick={() => {
                      setTempTitle(flowMeta.name);
                      setIsEditingTitle(true);
                    }}
                  />
                </div>
              )}
              <Tag color="geekblue">v{flowMeta.latestVersion}</Tag>
              <Tooltip title="版本日志">
                <Button
                  type="text"
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={() => setHistoryVisible(true)}
                />
              </Tooltip>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Text type="secondary" style={{ fontSize: 10 }}>
                ID: {projectId.slice(0, 6)}...
              </Text>
              {renderSaveStatus()}
            </div>
          </div>
        </div>

        {/* --- 右侧功能区 (平铺开关) --- */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginRight: 16,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#666",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AppstoreOutlined /> 画布
              <Switch
                size="small"
                checked={showCanvas}
                onChange={setShowCanvas}
              />
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#666",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <FileTextOutlined /> 文档
              <Switch size="small" checked={showDoc} onChange={setShowDoc} />
            </span>
          </div>

          <Divider type="vertical" style={{ height: 20 }} />

          <Tooltip title="保存草稿 (Patch +1)">
            <Button icon={<DiffOutlined />} onClick={handleSaveDraft}>
              草稿
            </Button>
          </Tooltip>
          <Tooltip title="阶段存档 (Minor +1)">
            <Button icon={<SaveOutlined />} onClick={handleSaveMinor}>
              存档
            </Button>
          </Tooltip>
          <Tooltip title="生成新文件 (Major +1)">
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleSaveMajor}
            >
              发布
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Tree */}
        <div
          style={{
            width: isCenterVisible ? leftWidth : "25%", // 隐藏中间时占 25%
            background: "#fff",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #f0f0f0",
            transition: "width 0.2s",
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
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {sopData.nodes.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center" }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无节点"
                />
                <Button
                  icon={<PlusOutlined />}
                  onClick={handleCreateRoot}
                  type="dashed"
                  style={{ marginTop: 16 }}
                >
                  创建根节点
                </Button>
              </div>
            ) : (
              <Tree
                className="draggable-tree"
                treeData={treeData}
                expandedKeys={expandedKeys}
                onExpand={setExpandedKeys}
                selectedKeys={[editingNodeId]}
                onSelect={([key]) => handleNodeSelect(key)}
                draggable
                onDrop={onTreeDrop}
                blockNode
                showLine={{ showLeafIcon: false }}
                titleRender={(nodeData) => {
                  const nodeItem = allNodesWithCode.find(
                    (n) => n.id === nodeData.key
                  );
                  const targetId = nodeItem?.data?.jumpTargetId;
                  const targetNode = targetId
                    ? allNodesWithCode.find((n) => n.id === targetId)
                    : null;
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
                      {" "}
                      <span style={{ display: "flex", alignItems: "center" }}>
                        {" "}
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
                        </Tag>{" "}
                        <span>{nodeData.title}</span>{" "}
                        {targetId && (
                          <Tooltip
                            title={`跳转至: ${targetNode?.code || "未知"}`}
                          >
                            <AimOutlined
                              style={{
                                marginLeft: 6,
                                color: "#faad14",
                                fontSize: 12,
                              }}
                            />
                          </Tooltip>
                        )}{" "}
                      </span>{" "}
                      <span onClick={(e) => e.stopPropagation()}>
                        {" "}
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined style={{ fontSize: 12 }} />}
                          onClick={() => addBranch(nodeData.key)}
                        />{" "}
                        {nodeData.key !== "root" && (
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                            onClick={() => deleteNode(nodeData.key)}
                          />
                        )}{" "}
                      </span>{" "}
                    </div>
                  );
                }}
              />
            )}
          </div>
        </div>

        {/* Left Resizer (仅中间可见时显示) */}
        {isCenterVisible && (
          <Resizer
            onResize={(d) => setLeftWidth((p) => Math.max(minWidth, p + d))}
          />
        )}

        {/* Center Content (Canvas/Doc) */}
        {isCenterVisible && (
          <div
            style={{
              flex: 1,
              background: "#f5f5f5",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* 视图切换 Tabs (仅双开时显示) */}
            {sopData.nodes.length > 0 && showCanvas && showDoc && (
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
            )}

            <div style={{ flex: 1, position: "relative" }}>
              {sopData.nodes.length > 0 ? (
                effectiveViewMode === "canvas" ? (
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
                )
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    flexDirection: "column",
                    color: "#999",
                  }}
                >
                  <PartitionOutlined
                    style={{ fontSize: 48, marginBottom: 16, color: "#e0e0e0" }}
                  />
                  <div>请先在左侧目录创建流程</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Resizer (仅中间可见时显示) */}
        {editingNodeId && isCenterVisible && (
          <Resizer
            onResize={(d) => setRightWidth((p) => Math.max(minWidth, p - d))}
          />
        )}

        {/* Right Property */}
        {editingNodeId && (
          <div
            style={{
              width: isCenterVisible ? rightWidth : "75%", // 隐藏中间时占 75%
              background: "#fff",
              borderLeft: "1px solid #ddd",
              transition: "width 0.2s",
            }}
          >
            <PropertyPanel
              form={form}
              currentEditNode={currentEditNode}
              jumpTargets={jumpTargets}
              onNodeChange={handleNodeChange}
              onClose={() => setEditingNodeId(null)}
              lastSaveTime={lastSaveTime}
            />
          </div>
        )}
      </div>

      <VersionHistoryModal
        projectId={projectId}
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </div>
  );
};

export default SOPEditor;
