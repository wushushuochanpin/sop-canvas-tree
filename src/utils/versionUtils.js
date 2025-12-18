/**
 * 解析版本号
 * 支持输入: "1", "1.0", "1.0.0" -> 输出标准对象 { major, minor, patch }
 */
export const parseVersion = (v) => {
  if (v === undefined || v === null) return { major: 1, minor: 0, patch: 0 };

  const str = String(v);
  const parts = str.split(".").map((num) => parseInt(num) || 0);

  return {
    major: parts[0] || 1,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
};

/**
 * 格式化版本号 -> "X.Y.Z"
 */
export const formatVersion = (v) => {
  const { major, minor, patch } = parseVersion(v);
  return `${major}.${minor}.${patch}`;
};

/**
 * 获取下一补丁版本 (自动保存/保存草稿)
 * 规则：Patch + 1
 * 例如: 1.0.0 -> 1.0.1
 */
export const getNextPatchVersion = (v) => {
  const { major, minor, patch } = parseVersion(v);
  return `${major}.${minor}.${patch + 1}`;
};

/**
 * 获取下一小版本 (仅保存)
 * 规则：Minor + 1, Patch 归零
 * 例如: 1.0.5 -> 1.1.0
 */
export const getNextMinorVersion = (v) => {
  const { major, minor } = parseVersion(v);
  return `${major}.${minor + 1}.0`;
};

/**
 * 获取下一大版本 (保存新版)
 * 规则：Major + 1, Minor 归零, Patch 归零
 * 例如: 1.2.3 -> 2.0.0
 */
export const getNextMajorVersion = (v) => {
  const { major } = parseVersion(v);
  return `${major + 1}.0.0`;
};
