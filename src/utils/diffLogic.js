/**
 * 深度比对两个流程数据的差异，生成详尽的审计日志
 * 格式增强：[Code] 节点名称 (ID: xxxx) 动作
 */
export const generateChangeLog = (oldData, newData) => {
  const logs = [];

  if (!oldData) {
    return ["初始化项目版本"];
  }

  // 1. 比对流程元数据 (标题)
  if (oldData.meta?.name !== newData.meta?.name) {
    logs.push(`流程名称由“${oldData.meta?.name}”修改为“${newData.meta?.name}”`);
  }

  const oldNodeMap = new Map(oldData.nodes.map((n) => [n.id, n]));

  // 2. 检查节点变更 (新增 & 修改)
  newData.nodes.forEach((newNode) => {
    const oldNode = oldNodeMap.get(newNode.id);
    // 获取增强信息：序号和ID
    const code = newNode.computedCode || "?";
    const idShort = newNode.id.slice(0, 8); // ID太长，截取前8位
    const nodeIdentity = `[${code}] ${newNode.data.label} (ID:${idShort})`;

    if (!oldNode) {
      // 新增
      logs.push(`新增节点 ${nodeIdentity}`);
    } else {
      // 修改：比对关键字段
      if (oldNode.data.label !== newNode.data.label) {
        logs.push(
          `节点 ${nodeIdentity} 名称变更: "${oldNode.data.label}" -> "${newNode.data.label}"`
        );
      }
      if (oldNode.data.description !== newNode.data.description) {
        logs.push(`节点 ${nodeIdentity} 修改了备注说明`);
      }
      if (oldNode.data.jumpTargetId !== newNode.data.jumpTargetId) {
        logs.push(`节点 ${nodeIdentity} 修改了跳转目标`);
      }
      if (
        JSON.stringify(oldNode.data.payload) !==
        JSON.stringify(newNode.data.payload)
      ) {
        logs.push(`节点 ${nodeIdentity} 更新了随路数据`);
      }
    }
  });

  // 3. 检查节点变更 (删除)
  const newNodeMap = new Map(newData.nodes.map((n) => [n.id, n]));
  oldData.nodes.forEach((oldNode) => {
    if (!newNodeMap.has(oldNode.id)) {
      // 这里的 code 可能因为节点删除了而计算不准，优先用旧数据的 code
      const code = oldNode.computedCode || "?";
      const idShort = oldNode.id.slice(0, 8);
      logs.push(`删除了节点 [${code}] ${oldNode.data.label} (ID:${idShort})`);
    }
  });

  // 4. 检查连线变更
  let edgeChanged = false;
  if (oldData.edges.length !== newData.edges.length) {
    edgeChanged = true;
  } else {
    const oldConnections = new Set(
      oldData.edges.map((e) => `${e.source}->${e.target}`)
    );
    const newConnections = new Set(
      newData.edges.map((e) => `${e.source}->${e.target}`)
    );
    if (oldConnections.size !== newConnections.size) edgeChanged = true;
    else {
      for (let conn of newConnections) {
        if (!oldConnections.has(conn)) {
          edgeChanged = true;
          break;
        }
      }
    }
  }

  if (edgeChanged) {
    logs.push("调整了流程结构 (连线变更)");
  }

  return logs;
};

export const hasContentChanged = (oldData, newData) => {
  if (!oldData) return true;
  const logs = generateChangeLog(oldData, newData);
  return logs.length > 0;
};
